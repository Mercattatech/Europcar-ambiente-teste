import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { getReceiptLocale, getCurrencyFromStation } from '@/lib/receiptLocales';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/resend-email/[resNumber]/preview
 *
 * Retorna um JSON com os dados que serão usados no e-mail reenviado,
 * incluindo o valor na moeda local e qual template será usado.
 * Usado pelo painel para mostrar o preview antes de enviar.
 */
export async function GET(
  _req: Request,
  { params }: { params: { resNumber: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resNumber } = params;

  const reservation = await prisma.localReservation.findFirst({
    where: {
      OR: [
        { resNumber },
        { merchantOrderId: resNumber },
      ],
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
  }

  let cd: any = {};
  try {
    cd = typeof reservation.customerData === 'string'
      ? JSON.parse(reservation.customerData)
      : reservation.customerData || {};
  } catch { /* mantém {} */ }

  const booking = cd?.booking || {};
  const car     = booking?.car || {};

  const country       = booking?.country || cd?.country || 'BR';
  const localeLookup  = getReceiptLocale(country);
  const amountBRL     = (reservation.amountInCents || 0) / 100;

  // Detecta moeda: estação > XRS > locale do país
  //   1. bookingCurrencyOfTotalRateEstimate (XRS)
  //   2. currency do car
  //   3. ESTAÇÃO de retirada (prefixo IATA) — resolve o problema do país
  //      ser a nacionalidade do cliente (ex: BR alugando em Lisboa → EUR)
  //   4. Locale do país → último recurso
  const stationCurrency = getCurrencyFromStation(booking?.pickupStation);
  const rawCurrency = (
    car?.bookingCurrencyOfTotalRateEstimate ||
    car?.currency ||
    ''
  ).toUpperCase().trim();

  const localCurrency = (rawCurrency && rawCurrency.length === 3)
    ? rawCurrency
    : (stationCurrency || localeLookup.currency);

  // Detecta valor: usa totalRateEstimate do car, senão usa amountBRL
  const rawAmount = parseFloat(
    car?.totalRateEstimate ||
    car?.total ||
    car?.totalRateInBookingCurrency ||
    '0'
  );

  let localAmount: number;
  let valorTotal: string;

  if (localCurrency !== 'BRL' && rawAmount > 0) {
    localAmount = rawAmount;
    try {
      valorTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: localCurrency,
        minimumFractionDigits: localCurrency === 'JPY' ? 0 : 2,
      }).format(localAmount);
    } catch {
      valorTotal = `${localCurrency} ${localAmount.toFixed(2)}`;
    }
  } else {
    // País não-BR mas sem valor local salvo: mostra BRL com nota
    localAmount = amountBRL;
    if (localCurrency !== 'BRL') {
      valorTotal = `${localCurrency} (equiv. R$ ${amountBRL.toFixed(2).replace('.', ',')})`;
    } else {
      valorTotal = `R$ ${amountBRL.toFixed(2).replace('.', ',')}`;
    }
  }

  return NextResponse.json({
    resNumber: reservation.resNumber || reservation.merchantOrderId,
    toEmail: cd?.email || '',
    customerName: `${cd?.nome || ''} ${cd?.sobrenome || ''}`.trim(),
    country,
    localeCurrency: localCurrency,
    localAmount,
    valorTotal,
    amountBRL,
    paymentMethod: cd?.paymentMethod || 'CREDIT',
    pickupStation: booking?.pickupStation || '',
    returnStation: booking?.returnStation || booking?.pickupStation || '',
    pickupDate: booking?.pickupDate || '',
    returnDate: booking?.returnDate || '',
    carName: car?.carCategoryName || car?.carCategorySample || '',
    carCategory: car?.carCategoryCode || '',
    // Debug: campos brutos do car para diagnóstico
    _debug: {
      car_bookingCurrencyOfTotalRateEstimate: car?.bookingCurrencyOfTotalRateEstimate,
      car_currency: car?.currency,
      car_totalRateEstimate: car?.totalRateEstimate,
      car_total: car?.total,
      car_totalRateInBookingCurrency: car?.totalRateInBookingCurrency,
      booking_country: booking?.country,
    },
  });
}
