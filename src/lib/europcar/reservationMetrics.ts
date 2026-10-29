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
  currencyLocal?: string;
  hasSplit?: boolean;
  counterNotice?: string | null;
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

  let bookingResponse: any = res?.bookingResponse || parsed?.bookingResponse || null;
  if (typeof bookingResponse === 'string') {
    try {
      bookingResponse = JSON.parse(bookingResponse);
    } catch {
      bookingResponse = null;
    }
  }
  const quoteFromResponse = bookingResponse?.reservation?.quote || bookingResponse?.quote || {};

  const booking = parsed?.booking || parsed?.bookingData || {};
  const car = booking?.car || (quoteFromResponse?.totalRateEstimate ? quoteFromResponse : {});
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
  const carCurrency = String(car?.currency || car?.bookingCurrencyOfTotalRateEstimate || quoteFromResponse?.currency || '').toUpperCase().trim();

  // Detecção de Devolução em outra agência (One-Way)
  const isOneWay = !!(pickupStation && returnStation && pickupStation !== returnStation);

  const isBrazilStation =
    stationCountry === 'BR' ||
    pickupStation.startsWith('BR') ||
    BRAZIL_AIRPORTS.some(code => pickupStation.startsWith(code)) ||
    (carCurrency === 'BRL' && !['EUR', 'USD', 'GBP'].includes(carCurrency));

  const rawExchangeRate = parseFloat(car?.exchangeRate || booking?.exchangeRate || quoteFromResponse?.exchangeRate || '0');
  const xrsTotalLocal = parseFloat(car?.totalRateEstimate || quoteFromResponse?.totalRateEstimate || '0');
  const xrsTotalBRL = parseFloat(car?.totalRateEstimateInBookingCurrency || quoteFromResponse?.totalRateEstimateInBookingCurrency || '0');
  // Se XRS forneceu total em BRL e total em EUR, a taxa real da Europcar é a proporção exata:
  const derivedExchangeRate = (xrsTotalBRL > 0 && xrsTotalLocal > 0) ? (xrsTotalBRL / xrsTotalLocal) : 0;
  const exchangeRate = rawExchangeRate > 0 ? rawExchangeRate : (derivedExchangeRate > 0 ? derivedExchangeRate : 6.1);

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

  // Divisão de Pagamento salva (PaymentSplit)
  const split =
    parsed?.paymentSplit ||
    booking?.paymentSplit ||
    parsed?.bookingData?.paymentSplit ||
    parsed?.pricingSnapshot?.paymentSplit ||
    null;

  // 5. Classificação Confiável da Forma de Pagamento
  const chargedCents = Number(res?.amountInCents || 0);
  const chargedBRL = chargedCents > 0 ? chargedCents / 100 : 0;
  const splitOnlineBRL = Number(split?.online?.subtotalBRL || 0);
  const hasOnlinePayment = chargedBRL > 0 || splitOnlineBRL > 0;

  const rawPm = String(parsed?.paymentMethod || parsed?.paymentData?.method || '').toUpperCase().trim();
  let paymentMethod: 'PIX' | 'CREDIT' | 'BALCAO' | 'VOUCHER' | 'UNKNOWN' = 'UNKNOWN';

  if (rawPm === 'PIX' || isPendingPix) {
    paymentMethod = 'PIX';
  } else if (rawPm === 'CREDIT' || rawPm === 'CARTAO' || parsed?.creditCard || parsed?.cardLastFour || parsed?.cieloPaymentId || status === 'CONFIRMED_PREPAID') {
    paymentMethod = 'CREDIT';
  } else if (rawPm === 'VOUCHER' || status === 'VOUCHER') {
    paymentMethod = 'VOUCHER';
  } else if (rawPm === 'BALCAO' || status === 'CONFIRMED_NON_PREPAID') {
    paymentMethod = 'BALCAO';
  } else if (hasOnlinePayment) {
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
  const isPrepaid = isPixPaid || isCreditCard || (hasOnlinePayment && !isCancelled);

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

  let onlinePaidBRL = 0;
  let onlinePaidEUR = 0;
  let counterDueBRL = 0;
  let counterDueEUR = 0;
  let totalGeralBRL = 0;
  let totalGeralEUR = 0;

  if (split) {
    // ── Cenário A: Reserva com paymentSplit gerado (Fonte de Verdade Absoluta) ──
    if (isPrepaid) {
      onlinePaidBRL = typeof split.online?.subtotalBRL === 'number'
        ? split.online.subtotalBRL
        : (res?.amountInCents && Number(res.amountInCents) > 0 ? Number(res.amountInCents) / 100 : 0);

      onlinePaidEUR = typeof split.online?.subtotalLocal === 'number'
        ? split.online.subtotalLocal
        : (exchangeRate > 0 ? onlinePaidBRL / exchangeRate : 0);

      counterDueBRL = typeof split.counter?.subtotalBRL === 'number'
        ? split.counter.subtotalBRL
        : 0;

      counterDueEUR = typeof split.counter?.subtotalLocal === 'number'
        ? split.counter.subtotalLocal
        : (exchangeRate > 0 ? counterDueBRL / exchangeRate : 0);
    } else {
      // 100% no balcão
      onlinePaidBRL = 0;
      onlinePaidEUR = 0;
      counterDueBRL = typeof split.counter?.subtotalBRL === 'number'
        ? split.counter.subtotalBRL
        : (typeof split.totalBRL === 'number' ? split.totalBRL : (xrsTotalBRL > 0 ? xrsTotalBRL : 0));

      counterDueEUR = typeof split.counter?.subtotalLocal === 'number'
        ? split.counter.subtotalLocal
        : (typeof split.totalLocal === 'number' ? split.totalLocal : (xrsTotalLocal > 0 ? xrsTotalLocal : (exchangeRate > 0 ? counterDueBRL / exchangeRate : 0)));
    }

    totalGeralBRL = typeof split.totalBRL === 'number' ? split.totalBRL : (onlinePaidBRL + counterDueBRL);
    totalGeralEUR = typeof split.totalLocal === 'number' ? split.totalLocal : (onlinePaidEUR + counterDueEUR);
  } else {
    // ── Cenário B: Fallback (reservas legadas ou importadas sem split pré-calculado) ──
    const chargedBRL = res?.amountInCents && Number(res.amountInCents) > 0 ? Number(res.amountInCents) / 100 : 0;
    const xrsRateBRL = xrsTotalBRL > 0
      ? xrsTotalBRL
      : (xrsTotalLocal > 0 && exchangeRate > 0 ? xrsTotalLocal * exchangeRate : 0);

    const explicitCounter = parseFloat(parsed?.amountCounter || booking?.payerSplit?.counterDueBRL || 0);

    if (isPrepaid) {
      onlinePaidBRL = chargedBRL > 0 ? chargedBRL : xrsRateBRL;
      onlinePaidEUR = (xrsTotalLocal > 0 && xrsTotalBRL > 0)
        ? (onlinePaidBRL / (xrsTotalBRL / xrsTotalLocal))
        : (exchangeRate > 0 ? onlinePaidBRL / exchangeRate : 0);

      if (explicitCounter > 0) {
        counterDueBRL = explicitCounter;
        counterDueEUR = exchangeRate > 0 ? counterDueBRL / exchangeRate : 0;
      } else if (xrsRateBRL > onlinePaidBRL + 0.05) {
        counterDueBRL = xrsRateBRL - onlinePaidBRL;
        counterDueEUR = xrsTotalLocal > 0
          ? Math.max(0, xrsTotalLocal - onlinePaidEUR)
          : (exchangeRate > 0 ? counterDueBRL / exchangeRate : 0);
      } else if (explicitCounterChargesBRL > 0 || equipBRL > 0) {
        counterDueBRL = explicitCounterChargesBRL + equipBRL;
        counterDueEUR = exchangeRate > 0 ? counterDueBRL / exchangeRate : 0;
      }

      totalGeralBRL = Math.max(xrsRateBRL, onlinePaidBRL + counterDueBRL);
      totalGeralEUR = Math.max(xrsTotalLocal, onlinePaidEUR + counterDueEUR);
    } else {
      // 100% no balcão
      counterDueBRL = xrsRateBRL > 0 ? xrsRateBRL + equipBRL : (chargedBRL > 0 ? chargedBRL : 0);
      counterDueEUR = xrsTotalLocal > 0 ? xrsTotalLocal : (exchangeRate > 0 ? counterDueBRL / exchangeRate : 0);
      onlinePaidBRL = 0;
      onlinePaidEUR = 0;
      totalGeralBRL = counterDueBRL;
      totalGeralEUR = counterDueEUR;
    }
  }

  // Arredondamento seguro para 2 casas decimais
  onlinePaidBRL = Math.round(onlinePaidBRL * 100) / 100;
  onlinePaidEUR = Math.round(onlinePaidEUR * 100) / 100;
  counterDueBRL = Math.round(counterDueBRL * 100) / 100;
  counterDueEUR = Math.round(counterDueEUR * 100) / 100;
  totalGeralBRL = Math.round(totalGeralBRL * 100) / 100;
  totalGeralEUR = Math.round(totalGeralEUR * 100) / 100;

  const hasSplit = split ? Boolean(split.hasSplit) : (onlinePaidBRL > 0 && counterDueBRL > 0.05);
  const currencyLocal = String(
    split?.currencyLocal ||
    split?.counter?.currencyLocal ||
    car?.currency ||
    booking?.quote?.currency ||
    (isBrazilStation ? 'BRL' : 'EUR')
  ).toUpperCase().trim();

  const sym = currencyLocal === 'EUR' ? '€' : (currencyLocal === 'USD' ? 'US$' : currencyLocal);
  const counterNotice = hasSplit
    ? `A pagar no balcão: ${sym} ${counterDueEUR.toFixed(2).replace('.', ',')} (~R$ ${counterDueBRL.toFixed(2).replace('.', ',')})`
    : null;

  // O valor principal da reserva (amountBRL / amountEUR) é sempre o TOTAL da locação,
  // garantindo que faturamento, relatórios e KPIs reflitam o valor integral contratado pelo cliente.
  const amountBRL = totalGeralBRL;
  const amountEUR = totalGeralEUR;

  const contractTotalEUR = xrsTotalLocal > 0 ? xrsTotalLocal : totalGeralEUR;
  const contractTotalBRL = xrsTotalBRL > 0 ? xrsTotalBRL : totalGeralBRL;

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
    currencyLocal,
    hasSplit,
    counterNotice,
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
