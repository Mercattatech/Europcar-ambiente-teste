/**
 * reservationMetrics.ts
 *
 * Módulo unificado para cálculo de métricas financeiras e classificação de reservas
 * utilizado em /painel/relatorios, /painel/reservas e exportações CSV.
 */

export interface ParsedReservationMetrics {
  amountBRL: number;
  amountEUR: number;
  isCancelled: boolean;
  isPendingPix: boolean;
  isActive: boolean;
  paymentMethod: 'PIX' | 'CREDIT' | 'BALCAO' | 'VOUCHER' | 'UNKNOWN';
  isPrepaid: boolean;
  isCounter: boolean;
  isPixPaid: boolean;
  isCreditCard: boolean;
  isVoucher: boolean;
  days: number;
  opStatus: string;
}

const BRAZIL_AIRPORTS = [
  'GRU', 'CGH', 'GIG', 'SDU', 'BSB', 'POA', 'SSA', 'REC', 'FOR', 'CNF',
  'CWB', 'FLN', 'VCP', 'BEL', 'MAO', 'MCZ', 'NAT', 'NVT', 'CGB', 'GYN'
];

export function computeReservationMetrics(res: any, parsedCustomerData?: any): ParsedReservationMetrics {
  let parsed: any = parsedCustomerData;
  if (!parsed && res?.customerData) {
    try {
      parsed = typeof res.customerData === 'string' ? JSON.parse(res.customerData) : res.customerData;
    } catch {
      parsed = {};
    }
  }
  parsed = parsed || {};

  const booking = parsed?.booking || parsed?.bookingData || {};
  const car = booking?.car || {};
  const opStatus = (res?.operationalStatus || 'R').toUpperCase();
  const status = (res?.status || '').toUpperCase();

  // 1. Canceladas
  const isCancelled =
    ['CANCELLED', 'CANCELLED_GREENWAY', 'ON_REQUEST_REJECTED'].includes(status) ||
    ['CC', 'CP', 'TD'].includes(opStatus);

  // 2. PIX Pendente (cliente gerou QR Code mas não concluiu pagamento)
  const isPendingPix = status === 'PENDING_PIX';

  // 3. Ativa / Venda Realizada (exclui canceladas e PIX pendentes não pagos)
  const isActive = !isCancelled && !isPendingPix;

  // 4. Detecção de Moeda e Estação
  const pickupStation = String(booking?.pickupStation || '').toUpperCase().trim();
  const stationCountry = String(booking?.stationCountry || parsed?.pais || '').toUpperCase().trim();
  const carCurrency = String(car?.currency || car?.bookingCurrencyOfTotalRateEstimate || '').toUpperCase().trim();

  const isBrazilStation =
    stationCountry === 'BR' ||
    pickupStation.startsWith('BR') ||
    BRAZIL_AIRPORTS.some(code => pickupStation.startsWith(code)) ||
    carCurrency === 'BRL';

  const exchangeRate = parseFloat(car?.exchangeRate || '0') || 6.1;

  // 5. Cálculo seguro do Valor em BRL
  let amountBRL = 0;
  if (res?.amountInCents && Number(res.amountInCents) > 0) {
    amountBRL = Number(res.amountInCents) / 100;
  } else if (car?.totalRateEstimateInBookingCurrency && !isNaN(parseFloat(car.totalRateEstimateInBookingCurrency))) {
    amountBRL = parseFloat(car.totalRateEstimateInBookingCurrency);
  } else if (car?.totalRateInBookingCurrency && !isNaN(parseFloat(car.totalRateInBookingCurrency))) {
    amountBRL = parseFloat(car.totalRateInBookingCurrency);
  } else if (car?.totalRateEstimate && !isNaN(parseFloat(car.totalRateEstimate))) {
    const rawVal = parseFloat(car.totalRateEstimate);
    // Se a estação for no Brasil, totalRateEstimate já está em BRL (NUNCA multiplicar pelo câmbio!)
    if (isBrazilStation || carCurrency === 'BRL') {
      amountBRL = rawVal;
    } else {
      amountBRL = rawVal * exchangeRate;
    }
  }

  // 6. Cálculo seguro do Valor em EUR (Net)
  let amountEUR = 0;
  if (carCurrency === 'EUR' && car?.totalRateEstimate && !isNaN(parseFloat(car.totalRateEstimate))) {
    amountEUR = parseFloat(car.totalRateEstimate);
  } else if (amountBRL > 0) {
    amountEUR = amountBRL / exchangeRate;
  }

  // 7. Classificação Confiável da Forma de Pagamento
  const rawPm = String(parsed?.paymentMethod || parsed?.paymentData?.method || '').toUpperCase().trim();
  let paymentMethod: 'PIX' | 'CREDIT' | 'BALCAO' | 'VOUCHER' | 'UNKNOWN' = 'UNKNOWN';

  if (rawPm === 'PIX' || isPendingPix) {
    paymentMethod = 'PIX';
  } else if (rawPm === 'CREDIT' || rawPm === 'CARTAO' || parsed?.creditCard || parsed?.cardLastFour) {
    paymentMethod = 'CREDIT';
  } else if (rawPm === 'BALCAO' || status === 'CONFIRMED_NON_PREPAID') {
    paymentMethod = 'BALCAO';
  } else if (rawPm === 'VOUCHER' || status === 'VOUCHER') {
    paymentMethod = 'VOUCHER';
  } else if (status === 'CONFIRMED_PREPAID') {
    paymentMethod = 'CREDIT';
  } else if (parsed?.cieloPaymentId) {
    paymentMethod = 'CREDIT';
  } else if (status === 'ON_REQUEST' || status === 'CONFIRMED') {
    paymentMethod = 'BALCAO';
  } else {
    paymentMethod = 'BALCAO';
  }

  const isPixPaid = paymentMethod === 'PIX' && !isPendingPix && !isCancelled;
  const isCreditCard = paymentMethod === 'CREDIT' && !isCancelled;
  const isCounter = paymentMethod === 'BALCAO' && !isCancelled;
  const isVoucher = paymentMethod === 'VOUCHER' && !isCancelled;
  const isPrepaid = isPixPaid || isCreditCard;

  const days = booking?.days ? parseInt(booking.days, 10) : 0;

  return {
    amountBRL,
    amountEUR,
    isCancelled,
    isPendingPix,
    isActive,
    paymentMethod,
    isPrepaid,
    isCounter,
    isPixPaid,
    isCreditCard,
    isVoucher,
    days,
    opStatus,
  };
}
