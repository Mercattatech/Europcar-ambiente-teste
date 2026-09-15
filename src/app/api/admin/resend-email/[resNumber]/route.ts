import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { resNumber: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resNumber } = params;

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

  // Extras / proteções (mesma lógica do reservas/route.ts)
  const extrasArr = Object.entries(extrasMap)
    .filter(([, v]: any) => (v as number) > 0)
    .map(([code, qty]: any) => ({ code, name: code, qty, priceBRL: 0 }));

  const listaProtecoes = extrasArr.length > 0
    ? extrasArr.map((ex: any) => `• ${ex.name || ex.code} ×${ex.qty}`).join('<br/>')
    : 'Nenhuma proteção adicional selecionada';

  const listaExtras = xrsEquipment.length > 0
    ? xrsEquipment.map((eq: any) =>
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
  const amountBRL     = (reservation.amountInCents || 0) / 100;

  // ── Valor na moeda local da reserva ──────────────────────
  // O XRS já retorna o valor na moeda do país — não é preciso converter.
  // Exemplos: reserva na Suíça → CHF 285.50 | na França → EUR 210.00
  const localAmount   = parseFloat(car?.totalRateEstimate || car?.total || '0');
  const localCurrency = (car?.bookingCurrencyOfTotalRateEstimate || car?.currency || '').toUpperCase();

  // Formata o valor na moeda local usando Intl.NumberFormat
  let valorTotal: string;
  if (localAmount > 0 && localCurrency && localCurrency !== 'BRL') {
    // Reserva internacional — usa moeda e valor do país
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
    // Reserva no Brasil ou moeda não identificada — usa BRL
    valorTotal = `R$ ${amountBRL.toFixed(2).replace('.', ',')}`;
  }

  const emailVars: Record<string, string> = {
    NOME:              cd?.nome        || '',
    SOBRENOME:         cd?.sobrenome   || '',
    EMAIL:             cd?.email       || '',
    TELEFONE:          cd?.telefone    || '',
    CPF:               cd?.cpf         || '',
    NUMERO_RESERVA:    finalResNumber,
    VALOR_TOTAL:       valorTotal,
    MOEDA:             localCurrency || 'BRL',
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
    sentTo:    toEmail,
    resNumber: finalResNumber,
    template:  result.success ? 'RESERVA_SUCESSO' : 'FALLBACK',
    provider:  'provider' in result ? result.provider : undefined,

  });
}
