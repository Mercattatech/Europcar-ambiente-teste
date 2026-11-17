import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { getReceiptLocale, getCurrencyFromStation } from '@/lib/receiptLocales';
import { calculateRentalDays } from '@/lib/europcar/rentalDuration';
import { buildExtrasListVars } from '@/lib/email/reservationEmailVars';
import { fetchXrsSnapshot } from '@/lib/email/xrsReservationSnapshot';
import { isEtoContract } from '@/lib/commissions/pricingSnapshot';
export const dynamic = 'force-dynamic';


export async function POST(
  req: Request,
  { params }: { params: { resNumber: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resNumber } = params;

  // Lê opções opcionais do body (moeda e valor override do admin)
  let overrideCurrency: string | undefined;
  let overrideAmount:   number  | undefined;
  let requestedTrigger: string  = 'RESERVA_SUCESSO';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.currency && typeof body.currency === 'string' && body.currency.length === 3) {
      overrideCurrency = body.currency.toUpperCase();
    }
    if (body?.amount && typeof body.amount === 'number' && body.amount > 0) {
      overrideAmount = body.amount;
    }
    if (body?.trigger && typeof body.trigger === 'string') {
      requestedTrigger = body.trigger.toUpperCase();
    }
  } catch { /* body vazio — usa detecção automática */ }

  // ── Busca reserva ─────────────────────────────────────────
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

  // ── Parse customerData ────────────────────────────────────
  let cd: any = {};
  try {
    cd = typeof reservation.customerData === 'string'
      ? JSON.parse(reservation.customerData)
      : reservation.customerData || {};
  } catch { /* mantém {} */ }

  const booking     = cd?.booking || {};
  const car         = booking?.car || {};
  const xrsEquipment: any[] = cd?.xrsEquipment || booking?.xrsEquipment || [];
  const extrasMap   = booking?.extras || {};

  const toEmail = cd?.email || '';
  if (!toEmail) {
    return NextResponse.json({ error: 'E-mail do cliente não encontrado na reserva' }, { status: 400 });
  }

  const finalResNumber = reservation.resNumber || reservation.merchantOrderId;

  // ── Mesmas variáveis do e-mail original ──────────────────
  // (espelha o bloco emailVars em /api/reservas/route.ts)

  const fmtDate = (d: string) =>
    d && d.length >= 8
      ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`
      : d || '';

  const fmtTime = (d: string) => {
    if (!d) return '';
    const tIdx = d.indexOf('T');
    if (tIdx >= 0) {
      const t = d.slice(tIdx + 1);
      return t.length >= 4 ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : t;
    }
    // formato HHMM direto (ex: "1000")
    if (/^\d{4}$/.test(d)) return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
    return '';
  };

  // Proteções/franquias e acessórios — dados locais + XML da reserva no XRS (fonte da verdade)
  const xrsSnap = await fetchXrsSnapshot(reservation.resNumber);
  const extraLists = buildExtrasListVars(
    cd,
    xrsSnap ? { xrsInsurances: xrsSnap.insurances, xrsEquipment: xrsSnap.equipment } : undefined,
  );
  const extrasArr = extraLists.extras;
  const listaProtecoes = extraLists.LISTA_PROTECOES;
  const listaExtras = extraLists.LISTA_EXTRAS;

  const fmtPagamento: Record<string, string> = {
    BALCAO: 'Pagamento no Balcão',
    PIX:    'PIX',
    CREDIT: 'Cartão de Crédito',
    VOUCHER:'Voucher ETO (Faturado)',
  };

  const paymentMethod = cd?.paymentMethod || 'CREDIT';
  const pickupDateRaw = booking?.pickupDate || '';
  const returnDateRaw = booking?.returnDate || '';
  const country       = booking?.country || cd?.country || 'BR';
  // Para TODOS os métodos: e-mail mostra total completo na moeda de destino + estimativa BRL
  const _baseAmountBRL = (reservation.amountInCents || 0) / 100;
  const _xrsIns  = cd?.xrsInsurances || cd?.booking?.xrsInsurances || [];
  const _xrsEq   = cd?.xrsEquipment  || cd?.booking?.xrsEquipment  || [];
  const _pickupD = booking?.pickupDate || '';
  const _returnD = booking?.returnDate || '';
  const _days = calculateRentalDays({
    pickupDate: _pickupD,
    pickupTime: booking?.pickupTime || '1000',
    returnDate: _returnD,
    returnTime: booking?.returnTime || '1000',
    station: booking?.pickupStation,
    country: booking?.stationCountry || booking?.driverCountry,
    apiDuration: booking?.duration || car?.duration,
  });
  const _vehicleBRL2 = parseFloat(car?.totalRateEstimateInBookingCurrency || car?.totalRateEstimate || '0');
  const _insBRL  = Array.isArray(_xrsIns) ? _xrsIns.reduce((s: number, ins: any) => s + parseFloat(ins.priceBRL || 0), 0) : 0;
  const _eqBRL   = Array.isArray(_xrsEq)  ? _xrsEq.reduce((s: number, eq: any) => {
    const t = parseFloat(eq.totalBRL || 0);
    const d = parseFloat(eq.priceBRL || 0);
    return s + (t > 0 ? t : d * _days) * (eq.qty || 1);
  }, 0) : 0;
  // Total completo: em reservas pré-pagas (cartão/PIX), o valor cobrado (_baseAmountBRL)
  // é a fonte da verdade e já inclui o markup comercial. A tarifa bruta da XRS (_vehicleBRL2)
  // é o NET de custo confidencial da locadora e NUNCA pode sobrescrever o valor pago pelo cliente.
  const _xrsTotalBRL = Number(xrsSnap?.quote?.totalBooking) || 0;
  const _extrasBRL = _insBRL + _eqBRL;
  const _isBalcao = paymentMethod === 'BALCAO';
  const _isEto = isEtoContract(booking?.contractID || car?.contractID);
  const _etoMargin = Number(booking?.etoMarginPercent || cd?.etoMarginPercent || cd?.pricingSnapshot?.markupPercent || 0);

  const _markedUpVehicleBRL = (_isEto && _etoMargin > 0 && _vehicleBRL2 > 0)
    ? Math.round(_vehicleBRL2 * (1 + _etoMargin / 100) * 100) / 100
    : _vehicleBRL2;

  const amountBRL = _isBalcao && _xrsTotalBRL > 0
    ? _xrsTotalBRL
    : _isBalcao && _extrasBRL > 0 && _vehicleBRL2 > _extrasBRL
      ? _vehicleBRL2
      : (!_isBalcao && _baseAmountBRL > 0)
        ? _baseAmountBRL
        : ((_markedUpVehicleBRL + _insBRL + _eqBRL) || _baseAmountBRL);

  // ── Moeda local da reserva ─────────────────────────────────────────────
  // Prioridade:
  //   1. currency do car (moeda da estação, ex.: EUR)
  //   2. moeda da cotação lida no XRS
  //   3. ESTAÇÃO de retirada (prefixo → moeda)
  //   4. Locale do país → último recurso
  // (bookingCurrencyOfTotalRateEstimate NÃO entra: é a moeda de PAGAMENTO — BRL —
  //  e fazia o e-mail sair só em R$.)
  const localeLookup    = getReceiptLocale(country);
  const stationCurrency = getCurrencyFromStation(booking?.pickupStation);
  const isForeignCur = (c?: string) => !!c && c.length === 3 && c.toUpperCase() !== 'BRL';
  const rawCurrency = [car?.currency, xrsSnap?.quote?.currency].find(isForeignCur)?.toUpperCase().trim() || '';
  const localCurrency = rawCurrency
    ? rawCurrency
    : (stationCurrency || localeLookup.currency);
    // ex: OPOT01→EUR | ZRHT01→CHF | GRUG01→BRL

  // Câmbio: car → cotação do XRS
  const exchRate = parseFloat(car?.exchangeRate || '0') || xrsSnap?.quote?.exchangeRate || 0;

  // Valor na moeda local (rawAmount = total do veículo na moeda local, fallback)
  const rawAmount = parseFloat(
    car?.totalRateEstimate ||
    car?.total ||
    car?.totalRateInBookingCurrency ||
    '0'
  );

  // Admin pode sobrescrever moeda e valor via body do request
  const finalCurrency = overrideCurrency || localCurrency;
  const finalAmount   = overrideAmount   || 0;

  const fmtLocal = (value: number) => {
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: finalCurrency,
        minimumFractionDigits: finalCurrency === 'JPY' || finalCurrency === 'KRW' ? 0 : 2,
      }).format(value);
    } catch {
      return `${finalCurrency} ${value.toFixed(2)}`;
    }
  };

  // Valor local + estimativa BRL para templates de e-mail
  const _valorBRL = `R$ ${amountBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let _valorLocal: string;
  if (finalCurrency === 'BRL') {
    const brlAmt = overrideAmount || amountBRL;
    _valorLocal = `R$ ${brlAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (finalAmount > 0) {
    _valorLocal = fmtLocal(finalAmount);
  } else if (_isBalcao && _xrsTotalBRL > 0 && xrsSnap?.quote && xrsSnap.quote.totalLocal > 0) {
    // BALCÃO: valor exato em moeda local direto da XRS (sem reconverter de R$)
    _valorLocal = fmtLocal(xrsSnap.quote.totalLocal);
  } else if (exchRate > 0) {
    // Converte o total (R$) pela taxa de câmbio da reserva
    _valorLocal = fmtLocal(amountBRL / exchRate);
  } else if (xrsSnap?.quote && xrsSnap.quote.totalLocal > 0) {
    _valorLocal = fmtLocal(xrsSnap.quote.totalLocal);
  } else if (rawAmount > 0) {
    _valorLocal = fmtLocal(rawAmount);
  } else {
    _valorLocal = `${finalCurrency} (ref. ${_valorBRL})`;
  }
  // VALOR_TOTAL: moeda local + estimativa BRL (para estações internacionais)
  const valorTotal = finalCurrency === 'BRL'
    ? _valorLocal
    : `${_valorLocal} (≈ ${_valorBRL})`;

  const pickupStationCode = booking?.pickupStation || '';
  const pickupStationName = booking?.pickupStationName || pickupStationCode;
  const pickupStationAddress = booking?.pickupStationAddress || booking?.pickupAddress || booking?.stationAddress || '';
  const pickupStationPhone = booking?.pickupStationPhone || '';

  const returnStationCode = booking?.returnStation || booking?.pickupStation || '';
  const returnStationName = booking?.returnStationName || (returnStationCode === pickupStationCode ? pickupStationName : returnStationCode);
  const returnStationAddress = booking?.returnStationAddress || booking?.returnAddress || (returnStationCode === pickupStationCode ? pickupStationAddress : '');
  const returnStationPhone = booking?.returnStationPhone || (returnStationCode === pickupStationCode ? pickupStationPhone : '');

  const formatLine = (name: string, code: string, addr: string) => {
    if (!code) return '';
    const head = name && name !== code ? `${name} (${code})` : code;
    return addr ? `${head} — ${addr}` : head;
  };

  const emailVars: Record<string, string> = {
    NOME:              cd?.nome        || '',
    SOBRENOME:         cd?.sobrenome   || '',
    EMAIL:             cd?.email       || '',
    TELEFONE:          cd?.telefone    || '',
    CPF:               cd?.cpf         || '',
    NUMERO_RESERVA:    finalResNumber,
    VALOR_TOTAL:       valorTotal,
    VALOR_LOCAL:       _valorLocal,
    VALOR_BRL:         _valorBRL,
    MOEDA:             finalCurrency,
    MOEDA_ESTRANGEIRA: finalCurrency !== 'BRL' ? '1' : '',
    FORMA_PAGAMENTO:   fmtPagamento[paymentMethod] || paymentMethod,
    CARRO:             car?.carCategoryName || car?.carCategorySample || car?.name || '',
    CATEGORIA_CARRO:   car?.carCategoryCode || car?.acrissCode || '',
    DATA_RETIRADA:     fmtDate(pickupDateRaw),
    HORARIO_RETIRADA:  fmtTime(pickupDateRaw) || fmtTime(booking?.pickupTime || ''),
    CODIGO_LOJA_RETIRADA: pickupStationCode,
    NOME_LOJA_RETIRADA: pickupStationName,
    ENDERECO_LOJA_RETIRADA: pickupStationAddress,
    TELEFONE_LOJA_RETIRADA: pickupStationPhone,
    LOCAL_RETIRADA:    formatLine(pickupStationName, pickupStationCode, pickupStationAddress),
    DATA_DEVOLUCAO:    fmtDate(returnDateRaw),
    HORARIO_DEVOLUCAO: fmtTime(returnDateRaw) || fmtTime(booking?.returnTime || ''),
    CODIGO_LOJA_DEVOLUCAO: returnStationCode,
    NOME_LOJA_DEVOLUCAO: returnStationName,
    ENDERECO_LOJA_DEVOLUCAO: returnStationAddress,
    TELEFONE_LOJA_DEVOLUCAO: returnStationPhone,
    LOCAL_DEVOLUCAO:   formatLine(returnStationName, returnStationCode, returnStationAddress),
    LISTA_PROTECOES:   listaProtecoes,
    LISTA_EXTRAS:      listaExtras,
  };

  // ── Determina qual trigger/template usar ──
  const VALID_TRIGGERS = ['RESERVA_SUCESSO', 'CANCELAMENTO', 'RESERVA_SOB_SOLICITACAO', 'RESERVA_ALTERADA', 'RESERVA_CONFIRMADA'];
  const trigger = VALID_TRIGGERS.includes(requestedTrigger) ? requestedTrigger : 'RESERVA_SUCESSO';

  const { sendTransactionalEmail } = await import('@/lib/emailService');
  const result = await sendTransactionalEmail(toEmail, trigger, emailVars);

  if (!result.success && result.error === 'Template não encontrado') {
    // Fallback: template não cadastrado → usa template hardcoded
    if (trigger === 'CANCELAMENTO') {
      console.warn('[resend-email] Template CANCELAMENTO não encontrado — usando fallback hardcoded.');
      const { sendCancellationEmail } = await import('@/lib/email/sendCancellationEmail');
      await sendCancellationEmail({
        toEmail,
        customerName: `${cd?.nome || ''} ${cd?.sobrenome || ''}`.trim(),
        resNumber:    finalResNumber,
        carName:      car?.carCategoryName || car?.carCategorySample || '',
        pickupStation: pickupStationCode,
        returnStation: returnStationCode,
        pickupStationName,
        returnStationName,
        pickupStationAddress,
        returnStationAddress,
        pickupStationPhone,
        returnStationPhone,
        pickupDate:   booking?.pickupDate || '',
        returnDate:   booking?.returnDate || '',
        paymentMethod,
        totalBRL:     amountBRL,
      });
    } else {
      console.warn(`[resend-email] Template ${trigger} não encontrado — usando fallback hardcoded.`);
      const { sendBookingConfirmation } = await import('@/lib/email/sendBookingConfirmation');
      await sendBookingConfirmation({
        toEmail,
        customerName: `${cd?.nome || ''} ${cd?.sobrenome || ''}`.trim(),
        resNumber:    finalResNumber,
        carName:      car?.carCategoryName || car?.carCategorySample || '',
        pickupStation: pickupStationCode,
        returnStation: returnStationCode,
        pickupStationName,
        returnStationName,
        pickupStationAddress,
        returnStationAddress,
        pickupStationPhone,
        returnStationPhone,
        pickupDate:   booking?.pickupDate || '',
        returnDate:   booking?.returnDate || '',
        paymentMethod,
        totalBRL:     amountBRL,
        isOnRequest:  trigger === 'RESERVA_SOB_SOLICITACAO' || reservation.operationalStatus === 'R',
        xrsEquipment: extraLists.equipment,
        extras:       extrasArr,
      });
    }
  }

  console.log(
    `[resend-email] E-mail reenviado para ${toEmail} | Reserva ${finalResNumber} | ` +
    `Trigger: ${trigger} | Template: ${result.success ? `painel (${trigger})` : 'fallback hardcoded'}`
  );

  return NextResponse.json({
    ok: true,
    sentTo:         toEmail,
    resNumber:      finalResNumber,
    localeCurrency: finalCurrency,
    valorTotal,
    trigger,
    template:       result.success ? trigger : 'FALLBACK',
    provider:       'provider' in result ? result.provider : undefined,
  });
}
