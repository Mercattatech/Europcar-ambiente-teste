import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint — compara o que pix-status vê vs diagnóstico
 * GET /api/admin/pix-debug?orderId=ORD...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const reserva = await prisma.localReservation.findUnique({ where: { merchantOrderId: orderId } });
  if (!reserva) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const parsed: any = JSON.parse(reserva.customerData as string);
  const paymentId = parsed.paymentId || parsed.cieloPaymentId || '';

  const cieloConfig = await prisma.cieloConfig.findFirst();
  if (!cieloConfig) return NextResponse.json({ error: 'no cielo config' }, { status: 500 });

  // Test with both URLs
  const prodUrl = `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;
  const sandboxUrl = `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;

  const headers = {
    MerchantId: cieloConfig.merchantId,
    MerchantKey: cieloConfig.merchantKey,
  };

  let prodResult: any = null;
  let sandboxResult: any = null;

  try {
    const res = await fetch(prodUrl, { headers });
    const json = await res.json();
    prodResult = { httpStatus: res.status, paymentStatus: json?.Payment?.Status, paymentType: json?.Payment?.Type, amount: json?.Payment?.Amount };
  } catch (e: any) {
    prodResult = { error: e.message };
  }

  try {
    const res = await fetch(sandboxUrl, { headers });
    const json = await res.json();
    sandboxResult = { httpStatus: res.status, paymentStatus: json?.Payment?.Status, paymentType: json?.Payment?.Type, amount: json?.Payment?.Amount };
  } catch (e: any) {
    sandboxResult = { error: e.message };
  }

  return NextResponse.json({
    orderId,
    dbStatus: reserva.status,
    paymentId,
    paymentIdSource: parsed.paymentId ? 'paymentId' : parsed.cieloPaymentId ? 'cieloPaymentId' : 'NONE',
    isSandboxConfig: cieloConfig.isSandbox,
    isSandboxType: typeof cieloConfig.isSandbox,
    isSandboxStrictTrue: cieloConfig.isSandbox === true,
    production: prodResult,
    sandbox: sandboxResult,
    customerDataKeys: Object.keys(parsed),
  });
}
