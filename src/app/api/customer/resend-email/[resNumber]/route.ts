import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
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
  const amountBRL     = (reservation.amountInCents || 0) / 100;
  const finalResNumber = reservation.resNumber || reservation.merchantOrderId || resNumber;

  // Valor na moeda da estação de retirada (+ estimativa BRL)
  const { buildEmailCurrencyVars } = await import('@/lib/receiptLocales');
  const _resExchangeRate = parseFloat(car?.exchangeRate || '0');
  const _currVars = buildEmailCurrencyVars(
    amountBRL,
    booking?.pickupStation || null,
    _resExchangeRate,
    car?.currency || null,
  );
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

  // Lista de proteções
  const listaProtecoes = Array.isArray(xrsEquipment)
    ? xrsEquipment.map((eq: any) => eq.description || eq.name || eq.code || '').filter(Boolean).join(', ')
    : '';

  // Lista de extras
  const extrasArr = Object.values(extrasMap || {}) as any[];
  const listaExtras = extrasArr.map((ex: any) => `${ex.name || ex.description || ''} (x${ex.quantity || 1})`).filter(Boolean).join(', ');

  const fmtPagamento: Record<string, string> = {
    CREDIT:  'Cartão de Crédito',
    PIX:     'PIX',
    BALCAO:  'Pagamento no Balcão',
    CARD:    'Cartão de Crédito',
    PREPAID: 'Cartão de Crédito',
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
    MOEDA:             'BRL',
    FORMA_PAGAMENTO:   fmtPagamento[paymentMethod] || paymentMethod,
    CARRO:             car?.carCategoryName || car?.carCategorySample || car?.name || '',
    CATEGORIA_CARRO:   car?.carCategoryCode || car?.acrissCode || '',
    DATA_RETIRADA:     fmtDate(booking?.pickupDate),
    HORARIO_RETIRADA:  fmtTime(booking?.pickupTime || ''),
    LOCAL_RETIRADA:    booking?.pickupStation || '',
    DATA_DEVOLUCAO:    fmtDate(booking?.returnDate),
    HORARIO_DEVOLUCAO: fmtTime(booking?.returnTime || ''),
    LOCAL_DEVOLUCAO:   booking?.returnStation || booking?.pickupStation || '',
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
      pickupStation: booking?.pickupStation || '',
      returnStation: booking?.returnStation || booking?.pickupStation || '',
      pickupDate:    booking?.pickupDate || '',
      returnDate:    booking?.returnDate || '',
      paymentMethod,
      totalBRL:      amountBRL,
      isOnRequest:   reservation.operationalStatus === 'R',
      xrsEquipment:  xrsEquipment,
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
