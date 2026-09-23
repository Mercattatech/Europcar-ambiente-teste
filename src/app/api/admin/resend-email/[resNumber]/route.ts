import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { getReceiptLocale, getCurrencyFromStation } from '@/lib/receiptLocales';
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
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.currency && typeof body.currency === 'string' && body.currency.length === 3) {
      overrideCurrency = body.currency.toUpperCase();
    }
    if (body?.amount && typeof body.amount === 'number' && body.amount > 0) {
      overrideAmount = body.amount;
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

  // Extras / proteções — usa xrsInsurances (salvo no customerData) para nomes amigáveis
  const xrsInsArr: any[] = cd?.xrsInsurances || cd?.booking?.xrsInsurances || [];
  const extrasArr = Object.entries(extrasMap)
    .filter(([, v]: any) => (v as number) > 0)
    .map(([code, qty]: any) => {
      const qi = xrsInsArr.find((i: any) => i.code === code);
      return { code, name: qi?.name || code, qty, priceBRL: qi?.priceBRL || 0 };
    });

  const listaProtecoes = extrasArr.length > 0
    ? extrasArr.map((ex: any) => `• 🛡️ ${ex.name || ex.code} ×${ex.qty}${ex.priceBRL > 0 ? ` — R$ ${parseFloat(ex.priceBRL).toFixed(2).replace('.', ',')}` : ''}`).join('<br/>')
    : 'Nenhuma proteção adicional selecionada';

  const equipArr: any[] = Array.isArray(xrsEquipment) ? xrsEquipment : [];
  const listaExtras = equipArr.length > 0
    ? equipArr.map((eq: any) =>
        `• ${eq.icon || '📦'} ${eq.name || eq.code} ×${eq.qty || 1}${eq.priceBRL ? ` — R$ ${parseFloat(eq.priceBRL).toFixed(2).replace('.', ',')} /dia` : ''}`
      ).join('<br/>')
    : 'Nenhum acessório selecionado';

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
  const _days = (() => {
    try {
      const diff = Math.ceil((new Date(_returnD).getTime() - new Date(_pickupD).getTime()) / 86400000);
      return diff > 0 ? diff : 1;
    } catch { return 1; }
  })();
  const _vehicleBRL2 = parseFloat(car?.totalRateEstimateInBookingCurrency || car?.totalRateEstimate || '0');
  const _insBRL  = Array.isArray(_xrsIns) ? _xrsIns.reduce((s: number, ins: any) => s + parseFloat(ins.priceBRL || 0), 0) : 0;
  const _eqBRL   = Array.isArray(_xrsEq)  ? _xrsEq.reduce((s: number, eq: any) => {
    const t = parseFloat(eq.totalBRL || 0);
    const d = parseFloat(eq.priceBRL || 0);
    return s + (t > 0 ? t : d * _days) * (eq.qty || 1);
  }, 0) : 0;
  // Total completo (fallback = amountInCents se booking não tiver dados suficientes)
  const amountBRL = (_vehicleBRL2 + _insBRL + _eqBRL) || _baseAmountBRL;

  // ── Moeda local da reserva ─────────────────────────────────────────────
  // Prioridade (da mais confiável para a menos):
  //   1. bookingCurrencyOfTotalRateEstimate do car (campo XRS direto)
  //   2. currency do car
  //   3. ESTAÇÃO de retirada (prefixo IATA → moeda)  ← principal fallback
  //      Resolve o problema de booking.country ser a NACIONALIDADE do cliente
  //      (ex: cliente BR que aluga em Lisboa → OPO/LIS → EUR, não BRL)
  //   4. Locale do país → último recurso
  const localeLookup    = getReceiptLocale(country);
  const stationCurrency = getCurrencyFromStation(booking?.pickupStation);
  const rawCurrency     = (
    car?.bookingCurrencyOfTotalRateEstimate ||
    car?.currency ||
    ''
  ).toUpperCase().trim();
  const localCurrency = (rawCurrency && rawCurrency.length === 3)
    ? rawCurrency
    : (stationCurrency || localeLookup.currency);
    // ex: OPOT01→EUR | ZRHT01→CHF | GRUG01→BRL

  // Valor na moeda local
  const rawAmount = parseFloat(
    car?.totalRateEstimate ||
    car?.total ||
    car?.totalRateInBookingCurrency ||
    '0'
  );

  // Admin pode sobrescrever moeda e valor via body do request
  const finalCurrency = overrideCurrency || localCurrency;
  const finalAmount   = overrideAmount   || rawAmount;

  // Valor local + estimativa BRL para templates de e-mail
  const _valorBRL = `R$ ${amountBRL.toFixed(2).replace('.', ',')}`;
  let _valorLocal: string;
  if (finalCurrency === 'BRL') {
    const brlAmt = overrideAmount || amountBRL;
    _valorLocal = `R$ ${brlAmt.toFixed(2).replace('.', ',')}`;
  } else if (finalAmount > 0) {
    try {
      _valorLocal = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: finalCurrency,
        minimumFractionDigits: finalCurrency === 'JPY' || finalCurrency === 'KRW' ? 0 : 2,
      }).format(finalAmount);
    } catch {
      _valorLocal = `${finalCurrency} ${finalAmount.toFixed(2)}`;
    }
  } else {
    // Sem valor local — converte via taxa de câmbio se disponível
    const exchRate = parseFloat(car?.exchangeRate || '0');
    if (exchRate > 0) {
      const converted = amountBRL / exchRate;
      try {
        _valorLocal = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: finalCurrency,
          minimumFractionDigits: 2,
        }).format(converted);
      } catch {
        _valorLocal = `${finalCurrency} ${converted.toFixed(2)}`;
      }
    } else {
      _valorLocal = `${finalCurrency} (ref. ${_valorBRL})`;
    }
  }
  // VALOR_TOTAL: moeda local + estimativa BRL (para estações internacionais)
  const valorTotal = finalCurrency === 'BRL'
    ? _valorLocal
    : `${_valorLocal} (≈ ${_valorBRL})`;

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
    FORMA_PAGAMENTO:   fmtPagamento[paymentMethod] || paymentMethod,
    CARRO:             car?.carCategoryName || car?.carCategorySample || car?.name || '',
    CATEGORIA_CARRO:   car?.carCategoryCode || car?.acrissCode || '',
    DATA_RETIRADA:     fmtDate(pickupDateRaw),
    HORARIO_RETIRADA:  fmtTime(pickupDateRaw) || fmtTime(booking?.pickupTime || ''),
    LOCAL_RETIRADA:    booking?.pickupStation || '',
    DATA_DEVOLUCAO:    fmtDate(returnDateRaw),
    HORARIO_DEVOLUCAO: fmtTime(returnDateRaw) || fmtTime(booking?.returnTime || ''),
    LOCAL_DEVOLUCAO:   booking?.returnStation || booking?.pickupStation || '',
    LISTA_PROTECOES:   listaProtecoes,
    LISTA_EXTRAS:      listaExtras,
  };

  // ── Envia usando o template cadastrado no painel (RESERVA_SUCESSO) ──
  const { sendTransactionalEmail } = await import('@/lib/emailService');
  const result = await sendTransactionalEmail(toEmail, 'RESERVA_SUCESSO', emailVars);

  if (!result.success && result.error === 'Template não encontrado') {
    // Fallback: template não cadastrado → usa template hardcoded
    console.warn('[resend-email] Template RESERVA_SUCESSO não encontrado — usando fallback hardcoded.');
    const { sendBookingConfirmation } = await import('@/lib/email/sendBookingConfirmation');
    await sendBookingConfirmation({
      toEmail,
      customerName: `${cd?.nome || ''} ${cd?.sobrenome || ''}`.trim(),
      resNumber:    finalResNumber,
      carName:      car?.carCategoryName || car?.carCategorySample || '',
      pickupStation: booking?.pickupStation || '',
      returnStation: booking?.returnStation || booking?.pickupStation || '',
      pickupDate:   booking?.pickupDate || '',
      returnDate:   booking?.returnDate || '',
      paymentMethod,
      totalBRL:     amountBRL,
      isOnRequest:  reservation.operationalStatus === 'R',
      xrsEquipment: xrsEquipment,
      extras:       extrasArr,
    });
  }

  console.log(
    `[resend-email] E-mail reenviado para ${toEmail} | Reserva ${finalResNumber} | ` +
    `Template: ${result.success ? 'painel (RESERVA_SUCESSO)' : 'fallback hardcoded'}`
  );

  return NextResponse.json({
    ok: true,
    sentTo:         toEmail,
    resNumber:      finalResNumber,
    localeCurrency: finalCurrency,
    valorTotal,
    template:       result.success ? 'RESERVA_SUCESSO' : 'FALLBACK',
    provider:       'provider' in result ? result.provider : undefined,
  });
}
