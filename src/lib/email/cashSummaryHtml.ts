/**
 * Resumo de caixa (e-mail) — espelho do resumo financeiro do checkout:
 *
 *   💳 PAGAR ON-LINE      (linhas com payer ba / valor cobrado no site)
 *   🏪 PAGAR NA RETIRADA  (linhas sem ba / cobradas no balcão, na moeda local)
 *   ✅ INCLUSO            (proteções a 0,00 com franquia — só quando há split)
 *   🟢 VALOR TOTAL        (+ "O pagamento da retirada será realizado em ..., no balcão da Europcar.")
 *
 * Variável de template: {{RESUMO_CAIXA}} (HTML pronto, tabelas com estilo inline — compatível
 * com Gmail/Outlook). Usada em RESERVA_SUCESSO, RESERVA_SOB_SOLICITACAO, RESERVA_CONFIRMADA,
 * RESERVA_ALTERADA e CANCELAMENTO.
 *
 * Fontes:
 *   - Reservas com paymentSplit (ETO, regra por linha ba × balcão): buildCashSummaryFromSplit.
 *   - Demais reservas: buildCashSummaryFromVars (valores já calculados para o e-mail).
 */
import {
  formatBRL,
  formatMoney,
  counterNotice,
  counterCurrencyNotice,
  includedExcessText,
  type PaymentSplit,
} from '@/lib/europcar/paymentSplit';

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface CashSummaryItem {
  label: string;
  /** Valor já formatado (vazio = só o texto) */
  value: string;
}

export interface CashSummaryBlock {
  title: string;
  main: string;
  /** Linha secundária abaixo do valor principal, ex.: "(€ 4.528,35)" */
  sub?: string;
  items: CashSummaryItem[];
  /** Texto em itálico no rodapé do bloco */
  note?: string;
}

export interface CashSummaryModel {
  online: CashSummaryBlock;
  counter: CashSummaryBlock;
  included: string[];
  total: { main: string; sub?: string; note: string };
}

const FONT = 'font-family:Arial,Helvetica,sans-serif;';

function itemsHtml(items: CashSummaryItem[], borderColor: string): string {
  if (items.length === 0) return '';
  const rows = items.map((i) => `
          <tr>
            <td valign="top" style="${FONT}padding:3px 8px 3px 0;font-size:12px;line-height:18px;color:#3d463f;">-&nbsp;${esc(i.label)}</td>
            <td align="right" valign="top" style="${FONT}padding:3px 0;font-size:12px;line-height:18px;color:#1f2421;font-weight:bold;white-space:nowrap;">${esc(i.value)}</td>
          </tr>`).join('');
  return `
      <tr><td colspan="2" style="padding:10px 0 0 0;border-top:1px solid ${borderColor};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}
        </table>
      </td></tr>`;
}

function blockHtml(
  icon: string,
  b: CashSummaryBlock,
  colors: { border: string; title: string; bg: string; inner: string; mainColor: string; subColor: string },
): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px 0;border:2px solid ${colors.border};border-radius:10px;background-color:${colors.bg};">
  <tr><td style="padding:14px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td valign="top" style="${FONT}padding:0 0 8px 0;font-size:12px;letter-spacing:1px;color:${colors.title};font-weight:900;text-transform:uppercase;">${icon}&nbsp;${esc(b.title)}</td>
        <td align="right" valign="top" style="${FONT}padding:0 0 8px 0;white-space:nowrap;">
          <span style="font-size:17px;color:${colors.mainColor};font-weight:900;">${esc(b.main)}</span>${b.sub ? `<br><span style="font-size:12px;color:${colors.subColor};font-weight:bold;">${esc(b.sub)}</span>` : ''}
        </td>
      </tr>${itemsHtml(b.items, colors.inner)}${b.note ? `
      <tr><td colspan="2" style="${FONT}padding:10px 0 0 0;border-top:1px solid ${colors.inner};font-size:12px;line-height:18px;color:${colors.title};">${esc(b.note)}</td></tr>` : ''}
    </table>
  </td></tr>
</table>`;
}

export function renderCashSummaryHtml(m: CashSummaryModel): string {
  const online = blockHtml('&#x1F4B3;', m.online, {
    border: '#a7dcc0', title: '#064e3b', bg: '#ffffff', inner: '#d1fae5', mainColor: '#1f2421', subColor: '#6d7a70',
  });
  const counter = blockHtml('&#x1F3EA;', m.counter, {
    border: '#fcd34d', title: '#451a03', bg: '#ffffff', inner: '#f3f4f6', mainColor: '#1f2421', subColor: '#6d7a70',
  });
  const included = m.included.length > 0 ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 12px 0;border:1px solid #dfe4dd;border-radius:10px;background-color:#f7f9f6;">
  <tr><td style="${FONT}padding:14px 16px;">
    <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:1px;color:#1f2421;font-weight:900;text-transform:uppercase;">&#x2705;&nbsp;Incluso</p>
    <p style="margin:0;font-size:12px;line-height:19px;color:#3d463f;">${m.included.map((t) => `<span style="color:#008d36;font-weight:bold;">&#x2713;</span>&nbsp;${esc(t)}`).join('<br>')}</p>
  </td></tr>
</table>` : '';
  const total = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;border:2px solid #fcd34d;border-radius:10px;background-color:#fffbeb;">
  <tr><td style="padding:14px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td valign="top" style="${FONT}font-size:12px;letter-spacing:1px;color:#451a03;font-weight:900;text-transform:uppercase;">&#x1F7E2;&nbsp;Valor total</td>
        <td align="right" valign="top" style="${FONT}white-space:nowrap;">
          <span style="font-size:19px;color:#451a03;font-weight:900;">${esc(m.total.main)}</span>${m.total.sub ? `<br><span style="font-size:12px;color:#92400e;font-weight:bold;">${esc(m.total.sub)}</span>` : ''}
        </td>
      </tr>
      <tr><td colspan="2" style="${FONT}padding:10px 0 0 0;border-top:1px solid #fde68a;font-size:12px;line-height:18px;color:#451a03;">${esc(m.total.note)}</td></tr>
    </table>
  </td></tr>
</table>`;
  return `${online}${counter}${included}${total}`;
}

// ─── A partir do paymentSplit (regra por linha: ba = on-line, sem ba = balcão) ──────────────

export function buildCashSummaryFromSplit(
  split: PaymentSplit,
  opts: { onlineTitle?: string; quilometragem?: string } = {},
): string {
  const cur = split.localCurrency;
  const foreign = !!cur && cur !== 'BRL';
  const sub = (local: number) => (foreign ? `(${formatMoney(local, cur)})` : undefined);
  const val = (brl: number, local: number) => (foreign ? `${formatBRL(brl)} (${formatMoney(local, cur)})` : formatBRL(brl));

  const online: CashSummaryBlock = split.online
    ? {
        title: opts.onlineTitle || 'Pagar on-line',
        main: formatBRL(split.online.subtotalBRL),
        sub: sub(split.online.subtotalLocal),
        // isPriceSecret="Y": a tarifa da conta empresarial não é detalhada para o condutor
        items: split.isPriceSecret ? [] : split.online.lines.map((l) => ({ label: l.label, value: val(l.priceBRL, l.priceLocal) })),
      }
    : {
        title: opts.onlineTitle || 'Pagar on-line',
        main: formatBRL(0),
        items: [],
        note: 'Nenhum valor a pagar on-line: todas as cobranças desta reserva são pagas no balcão.',
      };

  const counter: CashSummaryBlock = split.counter
    ? {
        title: 'Pagar na retirada',
        main: formatBRL(split.counter.subtotalBRL),
        sub: sub(split.counter.subtotalLocal),
        items: split.counter.lines.map((l) => ({ label: l.label, value: val(l.priceBRL, l.priceLocal) })),
        note: counterNotice(cur),
      }
    : {
        title: 'Pagar na retirada',
        main: foreign ? formatMoney(0, cur) : formatBRL(0),
        items: [],
        note: 'Nenhum valor adicional a pagar na retirada (apenas a caução temporária no cartão de crédito).',
      };

  const included: string[] = [];
  if (opts.quilometragem) included.push(`Quilometragem: ${opts.quilometragem.toLowerCase()}`);
  for (const i of split.included || []) {
    const exc = includedExcessText(i, cur);
    included.push(`${i.label}${exc ? ` (${exc})` : ''}`);
  }

  return renderCashSummaryHtml({
    online,
    counter,
    included,
    total: { main: formatBRL(split.totalBRL), sub: sub(split.totalLocal), note: counterCurrencyNotice(cur) },
  });
}

// ─── A partir das variáveis do e-mail (reservas sem paymentSplit) ───────────────────────────

const stripTags = (s: string) => String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/** "• Sobretaxa de aeroporto — € 12,80 (≈ R$ 77,29)" → { label, value } */
function parseListLines(html: string): CashSummaryItem[] {
  return String(html || '')
    .split(/<br\s*\/?>/i)
    .map((l) => stripTags(l).replace(/^[•\-]\s*/, ''))
    .filter((l) => l && !/^este valor será cobrado/i.test(l))
    .map((l) => {
      const idx = l.lastIndexOf(' — ');
      return idx > 0 ? { label: l.slice(0, idx).trim(), value: l.slice(idx + 3).trim() } : { label: l, value: '' };
    });
}

export function buildCashSummaryFromVars(v: Record<string, string>): string {
  const moeda = String(v.MOEDA || 'BRL').toUpperCase();
  const isBalcao = /balc/i.test(String(v.FORMA_PAGAMENTO || '')) && !/cart|pix|voucher/i.test(String(v.FORMA_PAGAMENTO || ''));
  const onlineMain = stripTags(v.VALOR_PAGO_ONLINE || '') || 'R$ 0,00';
  const counterMain = stripTags(v.VALOR_BALCAO || '');
  const counterItems = parseListLines(v.LISTA_BALCAO || '');
  if (isBalcao && counterItems.length === 0 && v.TEXTO_DIARIAS) {
    counterItems.push({ label: `Aluguel do veículo (${v.TEXTO_DIARIAS}) + taxas`, value: '' });
  }
  const onlineItems = parseListLines(v.LISTA_ONLINE || '');
  if (onlineItems.length === 0 && !isBalcao && v.TEXTO_DIARIAS && !/^R\$\s*0,00/.test(onlineMain)) {
    onlineItems.push({ label: `Diárias (${v.TEXTO_DIARIAS})`, value: '' });
  }
  const nothingAtCounter = !counterMain || /^nada a pagar/i.test(counterMain);
  return renderCashSummaryHtml({
    online: {
      title: v.PAGO_ONLINE_LABEL && !/^pago online$/i.test(v.PAGO_ONLINE_LABEL) ? v.PAGO_ONLINE_LABEL : 'Pagar on-line',
      main: onlineMain,
      items: onlineItems,
    },
    counter: {
      title: 'Pagar na retirada',
      main: nothingAtCounter ? (moeda !== 'BRL' ? formatMoney(0, moeda) : formatBRL(0)) : counterMain,
      items: counterItems,
      note: nothingAtCounter
        ? 'Nenhum valor adicional a pagar na retirada (apenas a caução temporária no cartão de crédito).'
        : counterNotice(moeda),
    },
    included: [],
    total: { main: stripTags(v.VALOR_TOTAL || v.TOTAL_RESERVA || ''), note: counterCurrencyNotice(moeda) },
  });
}

// ─── Templates antigos (salvos no painel) sem {{RESUMO_CAIXA}} ──────────────────────────────

/**
 * Troca a tabela de valores dos templates de reserva pelo {{RESUMO_CAIXA}}, mantendo título e
 * todos os textos informativos. Usado:
 *   - no envio (templates do painel ainda sem a variável) e
 *   - para gerar os HTMLs de docs/email-templates.
 * Se o template já tiver {{RESUMO_CAIXA}} (ou não tiver as seções conhecidas), volta inalterado.
 */
export function upgradeTemplateWithCashSummary(html: string): string {
  if (!html || /\{\{\s*RESUMO_CAIXA\s*\}\}/.test(html)) return html;
  const PLACEHOLDER = '{{RESUMO_CAIXA}}';
  // Confirmação / sob solicitação / confirmada / alterada: "Resumo de preço"
  let out = html.replace(/(Resumo de preço<\/p>\s*)<table[\s\S]*?<\/table>/, (_m, head) => `${head.replace('Resumo de preço', 'Resumo de caixa')}${PLACEHOLDER}`);
  // Cancelamento: "Valores da reserva cancelada"
  out = out.replace(/(Valores da reserva cancelada<\/p>\s*)<table[\s\S]*?<\/table>/, (_m, head) => `${head}${PLACEHOLDER}`);
  return out;
}
