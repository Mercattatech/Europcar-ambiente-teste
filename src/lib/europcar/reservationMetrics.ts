/**
 * reservationMetrics.ts
 *
 * Módulo unificado para cálculo de métricas financeiras e classificação de reservas
 * utilizado em /painel/relatorios, /painel/reservas e exportações CSV.
 */

export interface ParsedReservationMetrics {
  amountBRL: number;
  amountEUR: number;
  onlinePaidBRL?: number;
  onlinePaidEUR?: number;
  counterDueEUR?: number;
  counterDueBRL?: number;
  totalGeralBRL?: number;
  totalGeralEUR?: number;
  isOneWay?: boolean;
  oneWayFeeBRL?: number;
  oneWayFeeEUR?: number;
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
  contractTotalEUR?: number;
  contractTotalBRL?: number;
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
  const returnStation = String(booking?.returnStation || booking?.pickupStation || '').toUpperCase().trim();
  const stationCountry = String(booking?.stationCountry || '').toUpperCase().trim();
  const carCurrency = String(car?.currency || car?.bookingCurrencyOfTotalRateEstimate || '').toUpperCase().trim();

  // Detecção de Devolução em outra agência (One-Way)
  const isOneWay = !!(pickupStation && returnStation && pickupStation !== returnStation);

  const isBrazilStation =
    stationCountry === 'BR' ||
    pickupStation.startsWith('BR') ||
    BRAZIL_AIRPORTS.some(code => pickupStation.startsWith(code)) ||
    (carCurrency === 'BRL' && !['EUR', 'USD', 'GBP'].includes(carCurrency));

  const exchangeRate = parseFloat(car?.exchangeRate || booking?.exchangeRate || '0') || 6.1;

  // 4.1 Identificação da Taxa de Devolução (One-Way Fee)
  let oneWayFeeBRL = 0;
  let oneWayFeeEUR = 0;
  const quoteInsurances: any[] = booking?.quoteInsurances || booking?.car?.quoteInsurances || [];
  const oneWayItem = quoteInsurances.find((i: any) => {
    const c = String(i.code || '').toUpperCase();
    const d = String(i.descr || i.name || '').toLowerCase();
    return c.includes('ONEWAY') || c.includes('RELOC') || c === 'DROP' || d.includes('one way') || d.includes('devolu') || d.includes('inter-city');
  });

  if (oneWayItem) {
    const rawVal = parseFloat(oneWayItem.rentalPriceInBookingCurrencyAI || oneWayItem.priceInBookingCurrency || oneWayItem.price || '0');
    if (carCurrency === 'BRL' || isBrazilStation) {
      oneWayFeeBRL = rawVal;
      oneWayFeeEUR = exchangeRate > 0 ? rawVal / exchangeRate : 0;
    } else {
      oneWayFeeEUR = rawVal;
      oneWayFeeBRL = exchangeRate > 0 ? rawVal * exchangeRate : rawVal;
    }
  } else if (parsed?.taxaDevolucao || booking?.taxaDevolucao || parsed?.oneWayFee || booking?.oneWayFee) {
    const rawVal = parseFloat(parsed?.taxaDevolucao || booking?.taxaDevolucao || parsed?.oneWayFee || booking?.oneWayFee || '0');
    oneWayFeeBRL = rawVal;
    oneWayFeeEUR = exchangeRate > 0 ? rawVal / exchangeRate : 0;
  }

  // 5. Classificação Confiável da Forma de Pagamento
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

  // 6. Cálculo seguro do Valor em BRL
  let amountBRL = 0;
  const isBalcaoBooking = paymentMethod === 'BALCAO';
  const xrsRateBRL = parseFloat(car?.totalRateEstimateInBookingCurrency || '0');

  if (isBalcaoBooking && xrsRateBRL > 0) {
    amountBRL = xrsRateBRL;
  } else if (res?.amountInCents && Number(res.amountInCents) > 0) {
    amountBRL = Number(res.amountInCents) / 100;
  } else if (xrsRateBRL > 0) {
    amountBRL = xrsRateBRL;
  } else if (car?.totalRateInBookingCurrency && !isNaN(parseFloat(car.totalRateInBookingCurrency))) {
    amountBRL = parseFloat(car.totalRateInBookingCurrency);
  } else if (car?.totalRateEstimate && !isNaN(parseFloat(car.totalRateEstimate))) {
    const rawVal = parseFloat(car.totalRateEstimate);
    if (isBrazilStation || carCurrency === 'BRL') {
      amountBRL = rawVal;
    } else {
      amountBRL = rawVal * exchangeRate;
    }
  }

  // 7. Cálculo seguro do Valor em EUR sempre consistente com a taxa real da XRS
  let amountEUR = 0;
  if (carCurrency === 'EUR' && car?.totalRateEstimate && !isNaN(parseFloat(car.totalRateEstimate))) {
    amountEUR = parseFloat(car.totalRateEstimate);
    if (amountBRL === 0 && exchangeRate > 0) {
      amountBRL = amountEUR * exchangeRate;
    }
  } else if (amountBRL > 0 && exchangeRate > 0) {
    amountEUR = amountBRL / exchangeRate;
  } else if (amountBRL > 0) {
    amountEUR = amountBRL / exchangeRate;
  }

  // Contrato total XRS (quando o XML da XRS confirmar a cotação total de veículo + acessórios)
  const rawContractEUR = car?.totalRateEstimate && !isNaN(parseFloat(car.totalRateEstimate))
    ? parseFloat(car.totalRateEstimate)
    : 0;
  const contractTotalEUR = rawContractEUR > 0 ? rawContractEUR : amountEUR;
  const contractTotalBRL = isBrazilStation || carCurrency === 'BRL'
    ? contractTotalEUR
    : (contractTotalEUR * exchangeRate);

  // Cobranças específicas de balcão (Aeroporto, acessórios, extras)
  const AIRPORT_CODES = ['APF','APT','AIRPORTFEE','APS','ASF','APF2','APTF','STF'];
  const explicitCounterChargesBRL = quoteInsurances
    .filter((i: any) => i.paidBy === 'counter' || i.paidBy === 'business' || AIRPORT_CODES.includes(String(i.code || '').toUpperCase()))
    .reduce((sum: number, i: any) => {
      const v = parseFloat(i.rentalPriceInBookingCurrencyAI || i.priceInBookingCurrency || i.price || '0');
      const inBRL = (carCurrency === 'BRL' || isBrazilStation) ? v : (exchangeRate > 0 ? v * exchangeRate : v);
      return sum + inBRL;
    }, 0);

  const equipBRL = (booking?.xrsEquipment || []).reduce((sum: number, eq: any) => {
    const eqT = parseFloat(eq.totalBRL || 0);
    const eqD = parseFloat(eq.priceBRL || 0);
    const d = booking?.duration ? parseInt(booking.duration, 10) : (booking?.days ? parseInt(booking.days, 10) : 1);
    return sum + (eqT > 0 ? eqT : eqD * d) * (eq.qty || 1);
  }, 0);

  let counterDueEUR = 0;
  let counterDueBRL = 0;
  let onlinePaidBRL = 0;
  let onlinePaidEUR = 0;

  if (isPrepaid) {
    onlinePaidBRL = amountBRL;
    onlinePaidEUR = amountEUR;

    if (booking?.payerSplit?.counterDueBRL && parseFloat(booking.payerSplit.counterDueBRL) > 0) {
      counterDueBRL = parseFloat(booking.payerSplit.counterDueBRL);
      counterDueEUR = exchangeRate > 0 ? counterDueBRL / exchangeRate : 0;
    } else if (explicitCounterChargesBRL > 0 || equipBRL > 0) {
      counterDueBRL = explicitCounterChargesBRL + equipBRL;
      counterDueEUR = exchangeRate > 0 ? counterDueBRL / exchangeRate : 0;
    } else if (parsed?.amountCounter && parseFloat(parsed.amountCounter) > 0) {
      counterDueBRL = parseFloat(parsed.amountCounter);
      counterDueEUR = exchangeRate > 0 ? counterDueBRL / exchangeRate : 0;
    } else {
      const diffEUR = Math.max(0, contractTotalEUR - amountEUR);
      if (diffEUR > 0.05) {
        counterDueEUR = diffEUR;
        counterDueBRL = exchangeRate > 0 ? diffEUR * exchangeRate : diffEUR;
      }
    }
  } else {
    // 100% no balcão
    counterDueBRL = amountBRL + equipBRL;
    counterDueEUR = exchangeRate > 0 ? counterDueBRL / exchangeRate : amountEUR;
    onlinePaidBRL = 0;
    onlinePaidEUR = 0;
  }

  const totalGeralBRL = onlinePaidBRL + counterDueBRL;
  const totalGeralEUR = exchangeRate > 0 ? totalGeralBRL / exchangeRate : (onlinePaidEUR + counterDueEUR);

  const days = booking?.duration ? parseInt(booking.duration, 10) : (booking?.days ? parseInt(booking.days, 10) : 0);

  return {
    amountBRL,
    amountEUR,
    onlinePaidBRL,
    onlinePaidEUR,
    counterDueEUR,
    counterDueBRL,
    totalGeralBRL,
    totalGeralEUR,
    isOneWay,
    oneWayFeeBRL,
    oneWayFeeEUR,
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
    contractTotalEUR,
    contractTotalBRL,
  };
}
