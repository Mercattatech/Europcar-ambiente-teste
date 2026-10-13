/**
 * enrichReservationEmailVars
 *
 * Aplicado em sendTransactionalEmail para TODOS os e-mails de reserva (confirmação, sob
 * solicitação, confirmada, alterada, cancelamento). Garante, sem depender de cada rota:
 *
 *  1) Loja de retirada/devolução com NOME e ENDEREÇO completo (XRS getStation, com cache).
 *     LOCAL_RETIRADA / LOCAL_DEVOLUCAO passam de "LISX02" para
 *     "CORROIOS SEIXAL (LISX02) — endereço", então templates antigos já mostram a loja completa.
 *  2) Valores pago online (cartão/PIX) × a pagar no balcão — e demais variáveis do detalhamento —
 *     quando a rota montou as variáveis "na mão" (ex.: cancelamento). Os dados vêm da
 *     LocalReservation (NUMERO_RESERVA). Variáveis já enviadas pela rota NUNCA são sobrescritas.
 *
 * Nunca lança exceção: em qualquer falha devolve as variáveis originais.
 */
import prisma from '@/lib/prisma';
import { buildReservationEmailVars } from '@/lib/email/reservationEmailVars';
import { buildStationEmailVars, isStationCode } from '@/lib/europcar/stationInfo';

export const RESERVATION_TRIGGERS = new Set([
  'RESERVA_SUCESSO',
  'RESERVA_SOB_SOLICITACAO',
  'RESERVA_CONFIRMADA',
  'RESERVA_ALTERADA',
  'RESERVA_BALCAO',
  'CANCELAMENTO',
]);

const filled = (v: any) => typeof v === 'string' ? v.trim() !== '' : v != null;

export async function enrichReservationEmailVars(
  trigger: string,
  vars: Record<string, string>,
): Promise<Record<string, string>> {
  if (!RESERVATION_TRIGGERS.has(trigger)) return vars;
  const out: Record<string, string> = { ...vars };

  try {
    let booking: any = null;

    // ── 1) Variáveis faltantes (valores online × balcão etc.) a partir da reserva salva ──
    // buildReservationEmailVars sempre define PAGO_ONLINE_LABEL; se não veio, a rota montou
    // as variáveis por conta própria e completamos com os dados da LocalReservation.
    const resNumber = String(out.NUMERO_RESERVA || '').trim();
    if (resNumber) {
      const reservation = await prisma.localReservation.findFirst({
        where: { OR: [{ resNumber }, { merchantOrderId: resNumber }] },
        select: { customerData: true, amountInCents: true },
      });
      if (reservation?.customerData) {
        const cd: any = typeof reservation.customerData === 'string'
          ? JSON.parse(reservation.customerData)
          : reservation.customerData;
        booking = cd?.booking || null;

        if (!filled(out.PAGO_ONLINE_LABEL)) {
          const { vars: full } = buildReservationEmailVars({
            customerData: cd,
            resNumber,
            amountInCents: reservation.amountInCents,
            paymentMethod: cd?.paymentMethod,
          });
          for (const [k, v] of Object.entries(full)) {
            if (!filled(out[k]) && filled(v)) out[k] = v;
          }
        }
      }
    }

    // ── 2) Nome + endereço das lojas ──
    if (!filled(out.NOME_LOJA_RETIRADA)) {
      const pickup = [out.CODIGO_LOJA_RETIRADA, out.LOCAL_RETIRADA, booking?.pickupStation]
        .map((v) => String(v || '').trim().toUpperCase())
        .find(isStationCode);
      const ret = [out.CODIGO_LOJA_DEVOLUCAO, out.LOCAL_DEVOLUCAO, booking?.returnStation, pickup]
        .map((v) => String(v || '').trim().toUpperCase())
        .find(isStationCode);
      if (pickup) Object.assign(out, await buildStationEmailVars(pickup, ret));
    }
  } catch (err: any) {
    console.warn(`[enrichReservationEmailVars] ${trigger}: falha ao enriquecer variáveis:`, err?.message);
    return { ...vars, ...out };
  }

  return out;
}

/**
 * Padrões das variáveis novas — o motor de template deixa {{VAR}} cru quando a chave não existe,
 * então isto roda SEMPRE (inclusive quando o enriquecimento falha ou estoura o tempo).
 */
export function withReservationVarDefaults(vars: Record<string, string>): Record<string, string> {
  const out = { ...vars };
  for (const suf of ['RETIRADA', 'DEVOLUCAO']) {
    const code = String(out[`CODIGO_LOJA_${suf}`] || out[`LOCAL_${suf}`] || (suf === 'DEVOLUCAO' ? out.CODIGO_LOJA_RETIRADA || out.LOCAL_RETIRADA : '') || '');
    if (!filled(out[`CODIGO_LOJA_${suf}`])) out[`CODIGO_LOJA_${suf}`] = code;
    if (!filled(out[`NOME_LOJA_${suf}`])) out[`NOME_LOJA_${suf}`] = code;
    if (!(`ENDERECO_LOJA_${suf}` in out)) out[`ENDERECO_LOJA_${suf}`] = '';
    if (!(`TELEFONE_LOJA_${suf}` in out)) out[`TELEFONE_LOJA_${suf}`] = '';
  }
  if (!filled(out.PAGO_ONLINE_LABEL)) out.PAGO_ONLINE_LABEL = 'Pago online';
  return out;
}
