import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/resend-cancel-email/[resNumber]
 *
 * Re-sends the cancellation e-mail for a given reservation.
 */
export async function POST(
  req: Request,
  { params }: { params: { resNumber: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resNumber = params.resNumber;

  const reservation = await prisma.localReservation.findFirst({
    where: {
      OR: [{ resNumber }, { merchantOrderId: resNumber }],
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
  }

  const rawCd = reservation.customerData;
  const cd: any = typeof rawCd === 'string' ? JSON.parse(rawCd) : (rawCd || {});
  const booking = cd.booking || {};
  const car = booking.car || {};

  const toEmail = cd.email;
  if (!toEmail) {
    return NextResponse.json({ error: 'E-mail do cliente não encontrado nos dados da reserva' }, { status: 400 });
  }

  const finalResNumber = reservation.resNumber || reservation.merchantOrderId || resNumber;

  const fmtD = (d: string) => d && d.length >= 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : d || '';
  const fmtT = (t: string) => /^\d{4}$/.test(t) ? `${t.slice(0,2)}:${t.slice(2,4)}` : '';
  const amtBRL = (reservation.amountInCents || 0) / 100;
  const valorBRL = `R$ ${amtBRL.toFixed(2).replace('.',',')}`;
  const rawAmt = parseFloat(car?.totalRateEstimate || car?.total || '0');
  const localCur = (car?.bookingCurrencyOfTotalRateEstimate || car?.currency || 'BRL').toUpperCase();
  let valorLocal = valorBRL;
  if (localCur !== 'BRL' && rawAmt > 0) {
    try { valorLocal = new Intl.NumberFormat('pt-BR',{style:'currency',currency:localCur}).format(rawAmt); } catch { valorLocal = `${localCur} ${rawAmt.toFixed(2)}`; }
  }
  const valorTotal = localCur === 'BRL' ? valorLocal : `${valorLocal} (≈ ${valorBRL})`;
  const fmtPag: Record<string,string> = { BALCAO:'Pagamento no Balcão', PIX:'PIX', CREDIT:'Cartão de Crédito', VOUCHER:'Voucher ETO (Faturado)' };

  const { sendTransactionalEmail } = await import('@/lib/emailService');
  const result = await sendTransactionalEmail(toEmail, 'CANCELAMENTO', {
    NOME: cd.nome || '',
    SOBRENOME: cd.sobrenome || '',
    EMAIL: cd.email || '',
    TELEFONE: cd.telefone || '',
    NUMERO_RESERVA: finalResNumber,
    CARRO: car.carCategoryName || car.carCategorySample || car.name || '',
    CATEGORIA_CARRO: car.carCategoryCode || car.acrissCode || '',
    DATA_RETIRADA: fmtD(booking.pickupDate || ''),
    HORARIO_RETIRADA: fmtT(booking.pickupTime || ''),
    LOCAL_RETIRADA: booking.pickupStation || '',
    DATA_DEVOLUCAO: fmtD(booking.returnDate || ''),
    HORARIO_DEVOLUCAO: fmtT(booking.returnTime || ''),
    LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
    VALOR_LOCAL: valorLocal,
    VALOR_BRL: valorBRL,
    VALOR_TOTAL: valorTotal,
    MOEDA: localCur,
    FORMA_PAGAMENTO: fmtPag[cd.paymentMethod || ''] || cd.paymentMethod || '',
  });

  // Fallback to hardcoded template
  if (!result.success && result.error === 'Template não encontrado') {
    const { sendCancellationEmail } = await import('@/lib/email/sendCancellationEmail');
    await sendCancellationEmail({
      toEmail,
      customerName: `${cd.nome||''} ${cd.sobrenome||''}`.trim(),
      resNumber: finalResNumber,
      carName: car.carCategoryName || car.carCategorySample || '',
      pickupStation: booking.pickupStation || '',
      returnStation: booking.returnStation || booking.pickupStation || '',
      pickupDate: booking.pickupDate || '',
      returnDate: booking.returnDate || '',
      paymentMethod: cd.paymentMethod || '',
      totalBRL: amtBRL,
    });
  }

  console.log(`[resend-cancel-email] E-mail de cancelamento reenviado para ${toEmail} | Reserva ${finalResNumber}`);

  return NextResponse.json({
    ok: true,
    sentTo: toEmail,
    resNumber: finalResNumber,
    template: result.success ? 'CANCELAMENTO' : 'FALLBACK',
  });
}
