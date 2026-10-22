import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { calculateRentalDays } from '@/lib/europcar/rentalDuration';
import { buildExtrasListVars, buildDestinationCurrencyVars } from '@/lib/email/reservationEmailVars';
import { fetchXrsSnapshot } from '@/lib/email/xrsReservationSnapshot';
export const dynamic = 'force-dynamic';

/**
 * POST /api/customer/resend-email/[resNumber]
 *
 * Reenvio de e-mail de confirmação para o próprio cliente.
 * Requer sessão autenticada e verifica que a reserva pertence ao e-mail do cliente.
 */
export async function POST(
  _req: Request,
  { params }: { params: { resNumber: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { resNumber } = params;

  // ── Busca reserva ────────────────────────────────────────────
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

  // ── Parse customerData ───────────────────────────────────────
  let cd: any = {};
  try {
    cd = typeof reservation.customerData === 'string'
      ? JSON.parse(reservation.customerData)
      : reservation.customerData || {};
  } catch { /* mantém {} */ }

  // ── Verificação de propriedade ───────────────────────────────
  // A reserva só pode ser reenviada pelo próprio cliente
  const customerEmail = cd?.email || '';
  if (!customerEmail || customerEmail.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Você não tem permissão para acessar esta reserva' }, { status: 403 });
  }

  // ── Monta variáveis do e-mail ────────────────────────────────
  const booking       = cd?.booking || {};
  const car           = booking?.car || {};
  const xrsEquipment  = cd?.xrsEquipment || booking?.xrsEquipment || [];
  const extrasMap     = booking?.extras || {};
  const paymentMethod = cd?.paymentMethod || 'CREDIT';
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
  // Total completo (fallback = amountInCents se booking não tiver dados suficientes)
  const amountBRL = (_vehicleBRL2 + _insBRL + _eqBRL) || _baseAmountBRL;
  const finalResNumber = reservation.resNumber || reservation.merchantOrderId || resNumber;

  // Valor na moeda da estação de retirada (+ estimativa BRL) — câmbio do car ou da cotação no XRS
  const xrsSnap = await fetchXrsSnapshot(reservation.resNumber);
  const _currVars = buildDestinationCurrencyVars(amountBRL, booking, car, xrsSnap);
  const valorTotal = _currVars.VALOR_TOTAL;

  function fmtDate(d?: string) {
    if (!d) return '';
    if (/^\d{8}$/.test(d)) return `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}`;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR');
  }
  function fmtTime(t?: string) {
    if (!t) return '';
    const s = t.replace(/\D/g,'');
    return s.length >= 4 ? `${s.slice(0,2)}:${s.slice(2,4)}` : t;
  }

  // Proteções/franquias e acessórios — helper único (lê topo do customerData, booking e mapa extras)
  const extraLists = buildExtrasListVars(
    cd,
    xrsSnap ? { xrsInsurances: xrsSnap.insurances, xrsEquipment: xrsSnap.equipment } : undefined,
  );
  const extrasArr = extraLists.extras;
  const listaProtecoes = extraLists.LISTA_PROTECOES;
  const listaExtras = extraLists.LISTA_EXTRAS;

  const fmtPagamento: Record<string, string> = {
    CREDIT:  'Cartão de Crédito',
    PIX:     'PIX',
    BALCAO:  'Pagamento no Balcão',
    CARD:    'Cartão de Crédito',
    PREPAID: 'Cartão de Crédito',
  };

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
    EMAIL:             customerEmail,
    TELEFONE:          cd?.telefone    || '',
    CPF:               cd?.cpf         || '',
    NUMERO_RESERVA:    finalResNumber,
    VALOR_TOTAL:       _currVars.VALOR_TOTAL,
    VALOR_LOCAL:       _currVars.VALOR_LOCAL,
    VALOR_BRL:         _currVars.VALOR_BRL,
    MOEDA:             _currVars.MOEDA,
    MOEDA_ESTRANGEIRA: _currVars.MOEDA_ESTRANGEIRA,
    FORMA_PAGAMENTO:   fmtPagamento[paymentMethod] || paymentMethod,
    CARRO:             car?.carCategoryName || car?.carCategorySample || car?.name || '',
    CATEGORIA_CARRO:   car?.carCategoryCode || car?.acrissCode || '',
    DATA_RETIRADA:     fmtDate(booking?.pickupDate),
    HORARIO_RETIRADA:  fmtTime(booking?.pickupTime || ''),
    CODIGO_LOJA_RETIRADA: pickupStationCode,
    NOME_LOJA_RETIRADA: pickupStationName,
    ENDERECO_LOJA_RETIRADA: pickupStationAddress,
    TELEFONE_LOJA_RETIRADA: pickupStationPhone,
    LOCAL_RETIRADA:    formatLine(pickupStationName, pickupStationCode, pickupStationAddress),
    DATA_DEVOLUCAO:    fmtDate(booking?.returnDate),
    HORARIO_DEVOLUCAO: fmtTime(booking?.returnTime || ''),
    CODIGO_LOJA_DEVOLUCAO: returnStationCode,
    NOME_LOJA_DEVOLUCAO: returnStationName,
    ENDERECO_LOJA_DEVOLUCAO: returnStationAddress,
    TELEFONE_LOJA_DEVOLUCAO: returnStationPhone,
    LOCAL_DEVOLUCAO:   formatLine(returnStationName, returnStationCode, returnStationAddress),
    LISTA_PROTECOES:   listaProtecoes,
    LISTA_EXTRAS:      listaExtras,
  };

  // ── Envia e-mail ─────────────────────────────────────────────
  const { sendTransactionalEmail } = await import('@/lib/emailService');
  const result = await sendTransactionalEmail(customerEmail, 'RESERVA_SUCESSO', emailVars);

  if (!result.success && result.error === 'Template não encontrado') {
    const { sendBookingConfirmation } = await import('@/lib/email/sendBookingConfirmation');
    await sendBookingConfirmation({
      toEmail:       customerEmail,
      customerName:  `${cd?.nome || ''} ${cd?.sobrenome || ''}`.trim(),
      resNumber:     finalResNumber,
      carName:       car?.carCategoryName || car?.carCategorySample || '',
      pickupStation: pickupStationCode,
      pickupStationName,
      pickupStationAddress,
      pickupStationPhone,
      returnStation: returnStationCode,
      returnStationName,
      returnStationAddress,
      returnStationPhone,
      pickupDate:    booking?.pickupDate || '',
      returnDate:    booking?.returnDate || '',
      paymentMethod,
      totalBRL:      amountBRL,
      isOnRequest:   reservation.operationalStatus === 'R',
      xrsEquipment:  extraLists.equipment,
      extras:        extrasArr,
    });
  }

  console.log(`[customer/resend-email] Reenviado para ${customerEmail} | Reserva ${finalResNumber}`);

  return NextResponse.json({
    ok: true,
    sentTo: customerEmail,
    resNumber: finalResNumber,
  });
}
