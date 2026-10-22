/**
 * sendReservationConfirmationEmail
 *
 * Envio ÚNICO do e-mail de confirmação de reserva (cartão, PIX, cron, etc.).
 * 1) Template do painel (RESERVA_SUCESSO ou RESERVA_SOB_SOLICITACAO) com TODAS as variáveis
 *    (inclui proteções/franquias e acessórios contratados);
 * 2) Se falhar (template ausente ou provedor fora), cai no template hardcoded;
 * 3) Nunca lança exceção — a reserva já existe — mas sempre registra o resultado no log.
 */
import { sendTransactionalEmail } from '@/lib/emailService';
import { sendBookingConfirmation } from '@/lib/email/sendBookingConfirmation';
import { buildReservationEmailVars } from '@/lib/email/reservationEmailVars';
import { fetchXrsSnapshot } from '@/lib/email/xrsReservationSnapshot';

export interface SendReservationConfirmationParams {
  /** customerData no mesmo formato salvo na LocalReservation (com .booking, .xrsInsurances...) */
  customerData: any;
  resNumber: string;
  amountInCents?: number | null;
  paymentMethod?: string;
  isOnRequest?: boolean;
  extraVars?: Record<string, string>;
  /** Origem do disparo, só para o log (ex: 'pix-status', 'cron/sync-pix') */
  source?: string;
}

export async function sendReservationConfirmationEmail(p: SendReservationConfirmationParams): Promise<boolean> {
  const cd = p.customerData || {};
  const to: string = (cd.email || '').trim();
  const tag = `[reservation-email${p.source ? `:${p.source}` : ''}]`;

  if (!to) {
    console.warn(`${tag} Reserva ${p.resNumber} sem e-mail do cliente — confirmação não enviada.`);
    return false;
  }

  const trigger = p.isOnRequest ? 'RESERVA_SOB_SOLICITACAO' : 'RESERVA_SUCESSO';
  let built: ReturnType<typeof buildReservationEmailVars> | null = null;

  try {
    // XML da reserva no XRS (fonte da verdade). Timeout de 6s: nunca atrasa/bloqueia o e-mail.
    const xrs = await Promise.race([
      fetchXrsSnapshot(p.resNumber),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]).catch(() => null);

    built = buildReservationEmailVars({
      customerData: cd,
      resNumber: p.resNumber,
      amountInCents: p.amountInCents,
      paymentMethod: p.paymentMethod,
      extraVars: p.extraVars,
      xrs,
    });

    const r = await sendTransactionalEmail(to, trigger, built.vars);
    if (r.success) {
      console.log(`${tag} ✅ ${trigger} enviado para ${to} (reserva ${p.resNumber})`);
      return true;
    }
    console.warn(`${tag} Template ${trigger} falhou (${r.error}) — usando fallback hardcoded.`);
  } catch (err: any) {
    // Erro ao montar variáveis/template NÃO pode impedir o cliente de receber a confirmação.
    console.error(`${tag} Erro ao montar/enviar ${trigger} para ${p.resNumber}:`, err?.message || err);
  }

  const booking = cd.booking || {};
  const car = booking.car || {};
  let lists = built?.lists;
  if (!lists) {
    try {
      lists = (await import('@/lib/email/reservationEmailVars')).buildExtrasListVars(cd);
    } catch { /* sem listas no fallback */ }
  }

  return sendBookingConfirmation({
    toEmail: to,
    customerName: `${cd.nome || ''} ${cd.sobrenome || ''}`.trim(),
    resNumber: p.resNumber,
    carName: car.carCategoryName || car.name || '',
    pickupStation: booking.pickupStation || '',
    returnStation: booking.returnStation || booking.pickupStation || '',
    pickupStationName: built?.vars.NOME_LOJA_RETIRADA || booking.pickupStationName,
    pickupStationAddress: built?.vars.ENDERECO_LOJA_RETIRADA || booking.pickupStationAddress || booking.pickupAddress,
    pickupStationPhone: built?.vars.TELEFONE_LOJA_RETIRADA || booking.pickupStationPhone,
    returnStationName: built?.vars.NOME_LOJA_DEVOLUCAO || booking.returnStationName,
    returnStationAddress: built?.vars.ENDERECO_LOJA_DEVOLUCAO || booking.returnStationAddress || booking.returnAddress,
    returnStationPhone: built?.vars.TELEFONE_LOJA_DEVOLUCAO || booking.returnStationPhone,
    pickupDate: booking.pickupDate || '',
    returnDate: booking.returnDate || '',
    paymentMethod: p.paymentMethod || cd.paymentMethod || 'CREDIT',
    totalBRL: built?.totalBRL ?? (p.amountInCents || 0) / 100,
    isOnRequest: !!p.isOnRequest,
    xrsEquipment: lists?.equipment,
    extras: lists?.extras,
  });
}
