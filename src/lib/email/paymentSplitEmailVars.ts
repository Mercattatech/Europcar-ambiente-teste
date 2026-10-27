/**
 * Variáveis de e-mail da regra de pagamento on-line (conta empresarial) × balcão.
 *
 * Quando a reserva tem `paymentSplit` (calculado em src/lib/europcar/paymentSplit.ts),
 * estas variáveis substituem as do detalhamento antigo:
 *   VALOR_PAGO_ONLINE  — subtotal on-line "R$ 1.391,92 (€ 239,47)"
 *   LISTA_ONLINE       — itens do bloco on-line (VAZIO quando isPriceSecret="Y": a tarifa
 *                        da conta empresarial não aparece no e-mail do condutor)
 *   VALOR_BALCAO       — subtotal do balcão
 *   LISTA_BALCAO       — itens do balcão + aviso de cobrança na retirada
 *   LISTA_INCLUIDOS    — "Incluso" (proteções a 0,00 com franquia)
 *   TOTAL_RESERVA / VALOR_TOTAL — on-line + balcão
 */
import {
  formatBRL,
  formatMoney,
  formatBRLWithLocal,
  counterNotice,
  includedExcessText,
  type PaymentSplit,
  type SplitLine,
} from '@/lib/europcar/paymentSplit';

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Split gravado na reserva (confirmado no bookReservation) ou, na falta, o da cotação. */
export function getStoredPaymentSplit(customerData: any): PaymentSplit | null {
  const s = customerData?.paymentSplit || customerData?.booking?.paymentSplit;
  return s && s.version === 1 ? (s as PaymentSplit) : null;
}

export function buildPaymentSplitEmailVars(
  split: PaymentSplit,
  opts: { quilometragem?: string } = {},
): Record<string, string> {
  const cur = split.localCurrency;
  const fmt = (brl: number, local: number) => formatBRLWithLocal(brl, local, cur);
  const lineTxt = (l: SplitLine) => `• ${esc(l.label)} — ${fmt(l.priceBRL, l.priceLocal)}`;

  const online = split.online;
  const counter = split.counter;

  const includedLines: string[] = [];
  if (opts.quilometragem) includedLines.push(`• Quilometragem: ${esc(opts.quilometragem.toLowerCase())}`);
  for (const i of split.included || []) {
    const exc = includedExcessText(i, cur);
    includedLines.push(`• ${esc(i.label)}${exc ? ` (${exc})` : ''}`);
  }

  return {
    VALOR_PAGO_ONLINE: online ? fmt(online.subtotalBRL, online.subtotalLocal) : 'R$ 0,00 — nada foi cobrado online',
    LISTA_ONLINE: online && !split.isPriceSecret ? online.lines.map(lineTxt).join('<br/>') : '',
    VALOR_BALCAO: counter
      ? fmt(counter.subtotalBRL, counter.subtotalLocal)
      : 'Nada a pagar — apenas a caução (bloqueio temporário no cartão)',
    LISTA_BALCAO: counter
      ? [...counter.lines.map(lineTxt), `<em>${esc(counterNotice(cur))}</em>`].join('<br/>')
      : '',
    LISTA_INCLUIDOS: includedLines.join('<br/>'),
    TOTAL_RESERVA: fmt(split.totalBRL, split.totalLocal),
    VALOR_TOTAL: fmt(split.totalBRL, split.totalLocal),
    VALOR_BRL: formatBRL(split.totalBRL),
    VALOR_LOCAL: cur && cur !== 'BRL' ? formatMoney(split.totalLocal, cur) : formatBRL(split.totalBRL),
    // Os itens já estão discriminados nos blocos on-line/balcão
    VALOR_VEICULO: '',
    VALOR_PROTECOES: '',
    VALOR_ACESSORIOS: '',
  };
}
