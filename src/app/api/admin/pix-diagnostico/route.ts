import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

/**
 * Diagnóstico PIX — lista reservas PIX pendentes recentes
 * e tenta sincronizar verificando o status na Cielo.
 * GET /api/admin/pix-diagnostico
 */
export async function GET() {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca todas as reservas PIX pendentes das últimas 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const pendingPix = await prisma.localReservation.findMany({
      where: {
        status: { in: ['PENDING_PIX', 'ON_REQUEST'] },
        createdAt: { gte: yesterday },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const cieloConfig = await prisma.cieloConfig.findFirst();

    const results = [];

    for (const res of pendingPix) {
      let cieloStatus = 'N/A';
      let cieloPaymentStatus = -1;
      let paymentId = '';
      let hasPaymentId = false;

      try {
        const data: any = JSON.parse(res.customerData as string);
        paymentId = data.paymentId || '';
        hasPaymentId = !!paymentId;

        if (paymentId && cieloConfig) {
          const API = cieloConfig.isSandbox
            ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`
            : `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;

          const cieloRes = await fetch(API, {
            headers: {
              MerchantId: cieloConfig.merchantId,
              MerchantKey: cieloConfig.merchantKey,
            },
          });

          const cieloJson = await cieloRes.json();
          cieloPaymentStatus = cieloJson.Payment?.Status ?? -1;

          // Status mapping
          const statusMap: Record<number, string> = {
            0: 'NotFinished',
            1: 'Authorized',
            2: 'PaymentConfirmed',
            3: 'Denied',
            10: 'Voided',
            11: 'Refunded',
            12: 'Pending',
            13: 'Aborted',
            20: 'Scheduled',
          };
          cieloStatus = statusMap[cieloPaymentStatus] || `Unknown(${cieloPaymentStatus})`;
        }
      } catch (e: any) {
        cieloStatus = `Error: ${e.message}`;
      }

      results.push({
        id: res.id,
        merchantOrderId: res.merchantOrderId,
        resNumber: res.resNumber,
        status: res.status,
        amountInCents: res.amountInCents,
        amountBRL: res.amountInCents ? `R$ ${(res.amountInCents / 100).toFixed(2)}` : 'R$ 0,00',
        createdAt: res.createdAt,
        hasPaymentId,
        paymentId: paymentId ? `${paymentId.slice(0, 8)}...` : 'MISSING',
        cieloStatus,
        cieloPaymentStatus,
        isPaid: cieloPaymentStatus === 1 || cieloPaymentStatus === 2,
      });
    }

    return NextResponse.json({
      total: pendingPix.length,
      results,
      cieloConfigured: !!cieloConfig,
      isSandbox: cieloConfig?.isSandbox || false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
