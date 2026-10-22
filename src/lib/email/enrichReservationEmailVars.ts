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
import { buildStationEmailVars, extractStationCode, isStationCode } from '@/lib/europcar/stationInfo';

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

    // ── 2) Nome + endereço das lojas (retirada e devolução) ──
    const needPickupAddr = !filled(out.ENDERECO_LOJA_RETIRADA);
    const needReturnAddr = !filled(out.ENDERECO_LOJA_DEVOLUCAO);
    const needPickupName = !filled(out.NOME_LOJA_RETIRADA);
    const needReturnName = !filled(out.NOME_LOJA_DEVOLUCAO);

    if (needPickupAddr || needReturnAddr || needPickupName || needReturnName) {
      const pickupCandidates = [
        out.CODIGO_LOJA_RETIRADA,
        booking?.pickupStation,
        out.LOCAL_RETIRADA,
      ];
      let pickupCode: string | null = null;
      for (const cand of pickupCandidates) {
        const ext = extractStationCode(cand);
        if (ext) { pickupCode = ext; break; }
      }

      const retCandidates = [
        out.CODIGO_LOJA_DEVOLUCAO,
        booking?.returnStation,
        out.LOCAL_DEVOLUCAO,
        pickupCode,
      ];
      let retCode: string | null = null;
      for (const cand of retCandidates) {
        const ext = extractStationCode(cand);
        if (ext) { retCode = ext; break; }
      }

      const fallbackPickupAddr = booking?.pickupStationAddress || booking?.pickupAddress || booking?.stationAddress || '';
      const fallbackReturnAddr = booking?.returnStationAddress || booking?.returnAddress || (retCode === pickupCode ? fallbackPickupAddr : '');
      const fallbackPickupName = booking?.pickupStationName || out.NOME_LOJA_RETIRADA || '';
      const fallbackReturnName = booking?.returnStationName || out.NOME_LOJA_DEVOLUCAO || (retCode === pickupCode ? fallbackPickupName : '');
      const fallbackPickupPhone = booking?.pickupStationPhone || '';
      const fallbackReturnPhone = booking?.returnStationPhone || (retCode === pickupCode ? fallbackPickupPhone : '');

      if (pickupCode) {
        const stationVars = await buildStationEmailVars(pickupCode, retCode, {
          pickupName: fallbackPickupName,
          returnName: fallbackReturnName,
          pickupAddress: fallbackPickupAddr,
          returnAddress: fallbackReturnAddr,
          pickupPhone: fallbackPickupPhone,
          returnPhone: fallbackReturnPhone,
        });

        for (const [k, v] of Object.entries(stationVars)) {
          if (!filled(out[k]) || (k.startsWith('ENDERECO_') && filled(v))) {
            out[k] = v;
          }
        }
      }
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

  // Se devolução for a mesma loja da retirada e devolução estiver sem endereço, replica
  if (!filled(out.ENDERECO_LOJA_DEVOLUCAO) && filled(out.ENDERECO_LOJA_RETIRADA)) {
    const sameStation = !out.CODIGO_LOJA_DEVOLUCAO || out.CODIGO_LOJA_DEVOLUCAO === out.CODIGO_LOJA_RETIRADA;
    if (sameStation) {
      out.ENDERECO_LOJA_DEVOLUCAO = out.ENDERECO_LOJA_RETIRADA;
    }
  }

  if (!filled(out.PAGO_ONLINE_LABEL)) out.PAGO_ONLINE_LABEL = 'Pago online';
  return out;
}
