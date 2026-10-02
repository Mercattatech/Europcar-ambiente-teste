import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/checkAdmin';
import prisma from '@/lib/prisma';
import { readBooking } from '@/lib/europcar/xrsClient';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reservas/consultar-greenway
 *
 * Consulta os detalhes de uma reserva diretamente no GreenWay (Europcar XRS)
 * via search.searchbyid, trazendo os dados do cliente e da locação
 * para preenchimento e sincronização/cadastro automático no painel.
 *
 * Body: { resNumber: string }
 */
export async function POST(req: Request) {
  try {
    const isAdmin = await checkAdmin().catch(() => false);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado. Apenas administradores.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawResNumber = body.resNumber;

    if (!rawResNumber || typeof rawResNumber !== 'string' || !rawResNumber.trim()) {
      return NextResponse.json({ error: 'Número da reserva (resNumber) é obrigatório.' }, { status: 400 });
    }

    const cleanResNumber = rawResNumber.trim();

    // 1. Verificar se a reserva já existe no banco local
    const existing = await prisma.localReservation.findFirst({
      where: {
        OR: [
          { resNumber: cleanResNumber },
          { merchantOrderId: cleanResNumber },
        ],
      },
      select: {
        id: true,
        resNumber: true,
        merchantOrderId: true,
        status: true,
        operationalStatus: true,
        amountInCents: true,
        customerData: true,
        createdAt: true,
      },
    });

    let existingCustomerParsed: any = null;
    if (existing?.customerData) {
      try {
        existingCustomerParsed = typeof existing.customerData === 'string'
          ? JSON.parse(existing.customerData)
          : existing.customerData;
      } catch {}
    }

    // 2. Consultar o GreenWay (XRS)
    const xrs = await readBooking(cleanResNumber);

    if (!xrs.found) {
      return NextResponse.json({
        success: false,
        found: false,
        resNumber: cleanResNumber,
        alreadyExistsLocally: !!existing,
        existingReservation: existing ? {
          id: existing.id,
          resNumber: existing.resNumber,
          status: existing.status,
          operationalStatus: existing.operationalStatus,
          createdAt: existing.createdAt,
          customer: existingCustomerParsed,
        } : null,
        error: xrs.error || 'Reserva não encontrada no GreenWay (Europcar). Verifique o número digitado.',
      }, { status: 404 });
    }

    // Formatar datas caso venham no formato YYYYMMDD
    const fmtIsoDate = (d?: string) => {
      if (d && d.length === 8) {
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      }
      return d || '';
    };

    // Montar resposta normalizada
    return NextResponse.json({
      success: true,
      found: true,
      alreadyExistsLocally: !!existing,
      existingReservation: existing ? {
        id: existing.id,
        resNumber: existing.resNumber,
        merchantOrderId: existing.merchantOrderId,
        status: existing.status,
        operationalStatus: existing.operationalStatus,
        amountInCents: existing.amountInCents,
        createdAt: existing.createdAt,
        customer: existingCustomerParsed,
      } : null,
      data: {
        resNumber: xrs.resNumber || cleanResNumber,
        xrsStatusCode: xrs.xrsStatusCode,
        xrsStatus: xrs.xrsStatus,
        carCategory: xrs.carCategory || '',
        pickupStation: xrs.pickupStation || '',
        pickupDate: xrs.pickupDate || '',
        pickupDateFormatted: fmtIsoDate(xrs.pickupDate),
        pickupTime: xrs.pickupTime || '1000',
        returnStation: xrs.returnStation || xrs.pickupStation || '',
        returnDate: xrs.returnDate || '',
        returnDateFormatted: fmtIsoDate(xrs.returnDate),
        returnTime: xrs.returnTime || '1000',
        quote: xrs.quote || null,
        driver: {
          firstName: xrs.driver?.firstName || existingCustomerParsed?.nome || '',
          lastName: xrs.driver?.lastName || existingCustomerParsed?.sobrenome || '',
          email: xrs.driver?.email || existingCustomerParsed?.email || '',
          phone: xrs.driver?.phone || existingCustomerParsed?.telefone || '',
          country: xrs.driver?.country || existingCustomerParsed?.paisEmissao || 'BR',
        },
        warnings: xrs.warnings || [],
        isRejected: xrs.isRejected || false,
      },
    });

  } catch (error: any) {
    console.error('[consultar-greenway] Erro:', error);
    return NextResponse.json({
      error: 'Erro interno ao consultar GreenWay: ' + (error.message || String(error)),
    }, { status: 500 });
  }
}
