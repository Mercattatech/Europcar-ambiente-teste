/**
 * paymentSplitBooking — aplica a regra on-line (ba) × balcão na RESERVA CONFIRMADA.
 *
 * Fluxo:
 *   1. O Step 3 calcula o split na cotação (getQuote, já com os opcionais) e grava em
 *      bookingData.paymentSplit — é esse valor on-line que o checkout cobra na Cielo.
 *   2. Depois do bookReservation, recalculamos o split com o XML da reserva real
 *      (agora com resNumber) e conferimos com o valor cobrado.
 *   3. Bateu → gravamos o split da reserva (fonte XRS). Não bateu → mantemos o da
 *      cotação (é o que o cliente pagou) e gravamos log de alerta com o resNumber.
 *
 * Só se aplica quando o Step 3 gerou bookingData.paymentSplit (tarifas ETO).
 * POA (pagar no balcão / pré-pago EXO) segue o fluxo antigo.
 */
import { computePaymentSplit, formatBRL, AMOUNT_TOLERANCE, type PaymentSplit } from '@/lib/europcar/paymentSplit';
import { isZeroExcessBooking } from '@/lib/europcar/protectionSummary';

const round2 = (v: number) => Math.round(v * 100) / 100;

export function resolveBookedPaymentSplit(params: {
  bookResNode: any;
  bookingData: any;
  resNumber: string | null;
  /** Valor efetivamente cobrado on-line (R$) */
  chargedBRL: number;
  paymentMethod: string;
}): PaymentSplit | null {
  const quoteSplit: PaymentSplit | null = params.bookingData?.paymentSplit?.version === 1
    ? params.bookingData.paymentSplit
    : null;

  const tag = `[paymentSplit] resNumber=${params.resNumber || '-'}`;

  // Se não temos quoteSplit prévio, mas temos o nó real da reserva retornado pela Europcar:
  // calcula o split diretamente a partir do bookResNode
  if (!quoteSplit) {
    if (params.bookResNode) {
      try {
        const fallbackMarkup = Number(params.bookingData?.etoMarginPercent) || 0;
        const directSplit = computePaymentSplit(params.bookResNode, {
          resNumber: params.resNumber,
          isZeroExcess: isZeroExcessBooking(params.bookingData),
          onlineMarkupPercent: fallbackMarkup,
        });
        if (directSplit) {
          if (params.chargedBRL > 0 && directSplit.online && Math.abs(directSplit.online.subtotalBRL - params.chargedBRL) > AMOUNT_TOLERANCE) {
            directSplit.online.subtotalBRL = params.chargedBRL;
            directSplit.totalBRL = round2(params.chargedBRL + (directSplit.counter?.subtotalBRL ?? 0));
          }
          console.log(`${tag} ✅ split calculado diretamente do bookResNode: on-line ${formatBRL(directSplit.online?.subtotalBRL ?? 0)} · balcão ${formatBRL(directSplit.counter?.subtotalBRL ?? 0)}`);
          return directSplit;
        }
      } catch (err: any) {
        console.warn(`${tag} ⚠️ falha ao calcular split direto do bookResNode:`, err?.message);
      }
    }
    return null;
  }

  const markup = Number(quoteSplit.onlineMarkupPercent) || 0;
  const withRes = (s: PaymentSplit, extraAlert?: string): PaymentSplit => ({
    ...s,
    resNumber: params.resNumber || s.resNumber,
    alerts: extraAlert ? [...(s.alerts || []), extraAlert] : (s.alerts || []),
  });

  let bookSplit: PaymentSplit | null = null;
  try {
    bookSplit = params.bookResNode
      ? computePaymentSplit(params.bookResNode, {
          onlineMarkupPercent: markup,
          resNumber: params.resNumber,
          isZeroExcess: quoteSplit.isZeroExcess,
        })
      : null;
  } catch (err: any) {
    console.warn(`${tag} ⚠️ falha ao calcular o split da reserva:`, err?.message);
  }

  if (!bookSplit) {
    console.warn(`${tag} ⚠️ bookReservation sem chargeList/payerList — mantendo o split da cotação.`);
    return withRes(quoteSplit);
  }

  const isOnlinePayment = params.paymentMethod === 'CREDIT' || params.paymentMethod === 'PIX';
  const onlineBRL = bookSplit.online?.subtotalBRL ?? 0;
  if (isOnlinePayment && params.chargedBRL > 0 && Math.abs(onlineBRL - params.chargedBRL) > AMOUNT_TOLERANCE + 1e-9) {
    const msg = `valor cobrado on-line (${formatBRL(params.chargedBRL)}) diferente do on-line da reserva no XRS (${formatBRL(onlineBRL)}, markup ${markup}%). Mantido o split da cotação.`;
    console.warn(`${tag} 🚨 ${msg}`);
    return withRes({ ...quoteSplit, isPriceSecret: quoteSplit.isPriceSecret || bookSplit.isPriceSecret }, msg);
  }

  console.log(`${tag} ✅ split confirmado: on-line ${formatBRL(onlineBRL)} · balcão ${formatBRL(bookSplit.counter?.subtotalBRL ?? 0)}`);
  return bookSplit;
}
