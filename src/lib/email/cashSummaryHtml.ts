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
  isIncluded?: boolean;
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
  total: { title?: string; main: string; sub?: string; note: string };
}

const FONT = 'font-family:Arial,Helvetica,sans-serif;';

function itemsHtml(items: CashSummaryItem[], borderColor: string): string {
  if (items.length === 0) return '';
  const rows = items.map((i) => {
    const bullet = i.isIncluded
      ? `<span style="color:#008d36;font-weight:bold;">&#x2713;</span>`
      : '-';
    const valColor = i.isIncluded ? '#008d36' : '#1f2421';
    const valTd = i.value
      ? `<td align="right" valign="top" style="${FONT}padding:3px 0;font-size:12px;line-height:18px;color:${valColor};font-weight:bold;text-align:right;"><span style="white-space:nowrap;">${esc(i.value)}</span></td>`
      : '';
    const colSpan = i.value ? '' : ' colspan="2"';
    return `
          <tr>
            <td${colSpan} valign="top" style="${FONT}padding:3px 8px 3px 0;font-size:12px;line-height:18px;color:#3d463f;word-break:break-word;">${bullet}&nbsp;${esc(i.label)}</td>
            ${valTd}
          </tr>`;
  }).join('');
  return `
      <tr><td colspan="2" style="padding:10px 0 0 0;border-top:1px solid ${borderColor};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:100%;">${rows}
        </table>
      </td></tr>`;
}

function blockHtml(
  icon: string,
  b: CashSummaryBlock,
  colors: { border: string; title: string; bg: string; inner: string; mainColor: string; subColor: string },
): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:100%;box-sizing:border-box;margin:0 0 12px 0;border:2px solid ${colors.border};border-radius:10px;background-color:${colors.bg};">
  <tr><td style="padding:14px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
      <tr>
        <td valign="top" style="${FONT}padding:0 8px 8px 0;font-size:12px;letter-spacing:1px;color:${colors.title};font-weight:900;text-transform:uppercase;word-break:break-word;">${icon}&nbsp;${esc(b.title)}</td>
        <td align="right" valign="top" style="${FONT}padding:0 0 8px 0;text-align:right;">
          <span style="font-size:17px;color:${colors.mainColor};font-weight:900;white-space:nowrap;">${esc(b.main)}</span>${b.sub ? `<br><span style="font-size:12px;color:${colors.subColor};font-weight:bold;white-space:nowrap;">${esc(b.sub)}</span>` : ''}
        </td>
      </tr>${itemsHtml(b.items, colors.inner)}${b.note ? `
      <tr><td colspan="2" style="${FONT}padding:10px 0 0 0;border-top:1px solid ${colors.inner};font-size:12px;line-height:18px;color:${colors.title};word-break:break-word;">${esc(b.note)}</td></tr>` : ''}
    </table>
  </td></tr>
</table>`;
}

import type { EmailSummaryConfig } from './emailSummaryConfig';

export function renderCashSummaryHtml(m: CashSummaryModel, cfg?: EmailSummaryConfig['cashSummary']): string {
  const showOnline = cfg?.online ? cfg.online.enabled : true;
  const showCounter = cfg?.counter ? cfg.counter.enabled : true;
  const showTotal = cfg?.total ? cfg.total.enabled : true;

  const onlineBlock: CashSummaryBlock = {
    title: cfg?.online?.title || m.online.title || 'Pagar on-line',
    main: cfg?.online?.showSubtotalBRL !== false ? m.online.main : '',
    sub: cfg?.online?.showSubtotalLocal !== false ? m.online.sub : undefined,
    items: m.online.items,
    note: m.online.note,
  };

  const counterBlock: CashSummaryBlock = {
    title: cfg?.counter?.title || m.counter.title || 'A pagar no balcão',
    main: cfg?.counter?.showSubtotalBRL !== false ? m.counter.main : '',
    sub: cfg?.counter?.showSubtotalLocal !== false ? m.counter.sub : undefined,
    items: cfg?.counter?.showItemsList !== false ? m.counter.items : [],
    note: cfg?.counter?.showNotice !== false ? m.counter.note : undefined,
  };

  const totalBlock = {
    title: cfg?.total?.title || m.total.title || 'Valor total',
    main: cfg?.total?.showBRL !== false ? m.total.main : '',
    sub: cfg?.total?.showLocal !== false ? m.total.sub : undefined,
    note: m.total.note,
  };

  const online = showOnline
    ? blockHtml('&#x1F4B3;', onlineBlock, {
        border: '#a7dcc0', title: '#064e3b', bg: '#ffffff', inner: '#d1fae5', mainColor: '#1f2421', subColor: '#6d7a70',
      })
    : '';
  const counter = showCounter
    ? blockHtml('&#x1F3EA;', counterBlock, {
        border: '#fcd34d', title: '#451a03', bg: '#ffffff', inner: '#f3f4f6', mainColor: '#1f2421', subColor: '#6d7a70',
      })
    : '';
  const included = m.included.length > 0 ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:100%;box-sizing:border-box;margin:0 0 12px 0;border:1px solid #dfe4dd;border-radius:10px;background-color:#f7f9f6;">
  <tr><td style="${FONT}padding:14px 16px;">
    <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:1px;color:#1f2421;font-weight:900;text-transform:uppercase;">&#x2705;&nbsp;Incluso</p>
    <p style="margin:0;font-size:12px;line-height:19px;color:#3d463f;word-break:break-word;">${m.included.map((t) => `<span style="color:#008d36;font-weight:bold;">&#x2713;</span>&nbsp;${esc(t)}`).join('<br>')}</p>
  </td></tr>
</table>` : '';
  const total = showTotal ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:100%;box-sizing:border-box;margin:0;border:2px solid #fcd34d;border-radius:10px;background-color:#fffbeb;">
  <tr><td style="padding:14px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
      <tr>
        <td valign="top" style="${FONT}padding:0 8px 0 0;font-size:12px;letter-spacing:1px;color:#451a03;font-weight:900;text-transform:uppercase;word-break:break-word;">&#x1F7E2;&nbsp;${esc(totalBlock.title)}</td>
        <td align="right" valign="top" style="${FONT}text-align:right;">
          <span style="font-size:19px;color:#451a03;font-weight:900;white-space:nowrap;">${esc(totalBlock.main)}</span>${totalBlock.sub ? `<br><span style="font-size:12px;color:#92400e;font-weight:bold;white-space:nowrap;">${esc(totalBlock.sub)}</span>` : ''}
        </td>
      </tr>
      <tr><td colspan="2" style="${FONT}padding:10px 0 0 0;border-top:1px solid #fde68a;font-size:12px;line-height:18px;color:#451a03;word-break:break-word;">${esc(totalBlock.note)}</td></tr>
    </table>
  </td></tr>
</table>` : '';
  return `${online}${counter}${included}${total}`;
}

// ─── A partir do paymentSplit (regra por linha: ba = on-line, sem ba = balcão) ──────────────

export function buildCashSummaryFromSplit(
  split: PaymentSplit,
  opts: { onlineTitle?: string; quilometragem?: string; config?: EmailSummaryConfig['cashSummary'] } = {},
): string {
  const cur = split.localCurrency;
  const foreign = !!cur && cur !== 'BRL';
  const sub = (local: number) => (foreign ? `(${formatMoney(local, cur)})` : undefined);
  const val = (brl: number, local: number) => (foreign ? `${formatBRL(brl)} (${formatMoney(local, cur)})` : formatBRL(brl));

  const isVat = (l: { chrgTy?: string; label: string }) => l.chrgTy === '00028' || /imposto|vat/i.test(l.label);

  const cfgOn = opts.config?.online;
  const isOnlineItemVisible = (label: string) => {
    if (!cfgOn) return true;
    if (/diária|diarias|rental/i.test(label)) return cfgOn.showDailyRental !== false;
    if (/franquia zero|premium/i.test(label)) return cfgOn.showZeroExcess !== false;
    if (/básica|basica|roubo|danos|basic|theft|damage/i.test(label)) return cfgOn.showBasicProtections !== false;
    if (/aeroporto|airport/i.test(label)) return cfgOn.showAirportSurcharge !== false;
    if (/devolução em outra|one way|one-way/i.test(label)) return cfgOn.showOneWayCharge !== false;
    if (/alta temporada|estação|season/i.test(label)) return cfgOn.showHighSeasonSurcharge !== false;
    if (/licenciamento|emplacamento|taxa de circulação|fee|license/i.test(label)) return cfgOn.showLicensesAndFees !== false;
    return cfgOn.showOtherItems !== false;
  };

  const onlineItems: CashSummaryItem[] = [];
  if (split.online && !split.isPriceSecret) {
    for (const l of split.online.lines) {
      if (isVat(l)) continue;
      if (!isOnlineItemVisible(l.label)) continue;
      onlineItems.push({ label: l.label, value: '' });
    }
    for (const i of split.online.included || []) {
      if (!isOnlineItemVisible(i.label)) continue;
      const exc = includedExcessText(i, cur);
      onlineItems.push({
        label: `${i.label}${exc ? ` (${exc})` : ''}`,
        value: 'Incluso',
        isIncluded: true,
      });
    }
    if (opts.quilometragem && (cfgOn?.showOtherItems !== false)) {
      onlineItems.push({
        label: `Quilometragem: ${opts.quilometragem.toLowerCase()}`,
        value: 'Incluso',
        isIncluded: true,
      });
    }
  }

  const online: CashSummaryBlock = split.online
    ? {
        title: opts.config?.online?.title || opts.onlineTitle || 'Pagar on-line',
        main: formatBRL(split.online.subtotalBRL),
        sub: sub(split.online.subtotalLocal),
        items: onlineItems,
      }
    : {
        title: opts.config?.online?.title || opts.onlineTitle || 'Pagar on-line',
        main: formatBRL(0),
        items: [],
        note: 'Nenhum valor a pagar on-line: todas as cobranças desta reserva são pagas no balcão.',
      };

  const counterItems: CashSummaryItem[] = [];
  if (split.counter) {
    for (const l of split.counter.lines) {
      if (isVat(l)) continue;
      counterItems.push({ label: l.label, value: '' });
    }
    for (const i of split.counter.included || []) {
      const exc = includedExcessText(i, cur);
      counterItems.push({
        label: `${i.label}${exc ? ` (${exc})` : ''}`,
        value: 'Incluso',
        isIncluded: true,
      });
    }
  }

  const counter: CashSummaryBlock = split.counter
    ? {
        title: opts.config?.counter?.title || 'A pagar no balcão',
        main: formatBRL(split.counter.subtotalBRL),
        sub: sub(split.counter.subtotalLocal),
        items: counterItems,
        note: counterNotice(cur),
      }
    : {
        title: opts.config?.counter?.title || 'A pagar no balcão',
        main: foreign ? formatMoney(0, cur) : formatBRL(0),
        items: [],
        note: 'Nenhum valor adicional a pagar no balcão (apenas a caução temporária no cartão de crédito).',
      };

  return renderCashSummaryHtml({
    online,
    counter,
    included: [],
    total: { main: formatBRL(split.totalBRL), sub: sub(split.totalLocal), note: '' },
  }, opts.config);
}


// ─── A partir das variáveis do e-mail (reservas sem paymentSplit) ───────────────────────────

const stripTags = (s: string) => String(s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/** "• Sobretaxa de aeroporto — € 12,80" ou "• Proteção contra roubo — Incluso" ou "• Diárias" */
function parseListLines(html: string): CashSummaryItem[] {
  return String(html || '')
    .split(/<br\s*\/?>/i)
    .map((l) => stripTags(l).replace(/^[•\-]\s*/, ''))
    .filter((l) => l && !/^este valor será cobrado/i.test(l))
    .map((l) => {
      const idx = l.lastIndexOf(' — ');
      if (idx > 0) {
        const label = l.slice(0, idx).trim();
        const value = l.slice(idx + 3).trim();
        const isIncluded = /^incluso$/i.test(value);
        return { label, value: isIncluded ? 'Incluso' : '', isIncluded };
      }
      return { label: l, value: '' };
    });
}

export function buildCashSummaryFromVars(v: Record<string, string>, config?: EmailSummaryConfig['cashSummary']): string {
  const moeda = String(v.MOEDA || 'BRL').toUpperCase();
  const isBalcao = /balc/i.test(String(v.FORMA_PAGAMENTO || '')) && !/cart|pix|voucher/i.test(String(v.FORMA_PAGAMENTO || ''));
  const onlineMain = stripTags(v.VALOR_PAGO_ONLINE || '') || 'R$ 0,00';
  const counterMain = stripTags(v.VALOR_BALCAO || '');

  const cfgOn = config?.online;
  const isOnlineItemVisible = (label: string) => {
    if (!cfgOn) return true;
    if (/diária|diarias|rental/i.test(label)) return cfgOn.showDailyRental !== false;
    if (/franquia zero|premium/i.test(label)) return cfgOn.showZeroExcess !== false;
    if (/básica|basica|roubo|danos|basic|theft|damage/i.test(label)) return cfgOn.showBasicProtections !== false;
    if (/aeroporto|airport/i.test(label)) return cfgOn.showAirportSurcharge !== false;
    if (/devolução em outra|one way|one-way/i.test(label)) return cfgOn.showOneWayCharge !== false;
    if (/alta temporada|estação|season/i.test(label)) return cfgOn.showHighSeasonSurcharge !== false;
    if (/licenciamento|emplacamento|taxa de circulação|fee|license/i.test(label)) return cfgOn.showLicensesAndFees !== false;
    return cfgOn.showOtherItems !== false;
  };

  const counterItems = parseListLines(v.LISTA_BALCAO || '').filter((i) => !/imposto|vat/i.test(i.label));
  if (isBalcao && counterItems.length === 0 && v.TEXTO_DIARIAS) {
    counterItems.push({ label: `Aluguel do veículo (${v.TEXTO_DIARIAS}) + taxas`, value: '' });
  }
  let onlineItems = parseListLines(v.LISTA_ONLINE || '').filter((i) => !/imposto|vat/i.test(i.label));
  if (onlineItems.length === 0 && !isBalcao && v.TEXTO_DIARIAS && !/^R\$\s*0,00/.test(onlineMain)) {
    onlineItems.push({ label: `Diárias (${v.TEXTO_DIARIAS})`, value: '' });
  }
  onlineItems = onlineItems.filter((i) => isOnlineItemVisible(i.label));

  const nothingAtCounter = !counterMain || /^nada a pagar/i.test(counterMain);
  return renderCashSummaryHtml({
    online: {
      title: config?.online?.title || (v.PAGO_ONLINE_LABEL && !/^pago online$/i.test(v.PAGO_ONLINE_LABEL) ? v.PAGO_ONLINE_LABEL : 'Pagar on-line'),
      main: onlineMain,
      items: onlineItems,
    },
    counter: {
      title: config?.counter?.title || 'Pagar na retirada',
      main: nothingAtCounter ? (moeda !== 'BRL' ? formatMoney(0, moeda) : formatBRL(0)) : counterMain,
      items: counterItems,
      note: nothingAtCounter
        ? 'Nenhum valor adicional a pagar na retirada (apenas a caução temporária no cartão de crédito).'
        : counterNotice(moeda),
    },
    included: [],
    total: { main: stripTags(v.VALOR_TOTAL || v.TOTAL_RESERVA || ''), note: '' },
  }, config);
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
  if (!html) return html;
  let out = html;
  const PLACEHOLDER = '{{RESUMO_CAIXA}}';
  if (!/\{\{\s*RESUMO_CAIXA\s*\}\}/.test(out)) {
    // Confirmação / sob solicitação / confirmada / alterada: "Resumo de preço"
    out = out.replace(/(Resumo de preço<\/p>\s*)<table[\s\S]*?<\/table>/, (_m, head) => `${head.replace('Resumo de preço', 'Resumo de caixa')}${PLACEHOLDER}`);
    // Cancelamento: "Valores da reserva cancelada"
    out = out.replace(/(Valores da reserva cancelada<\/p>\s*)<table[\s\S]*?<\/table>/, (_m, head) => `${head}${PLACEHOLDER}`);
  }
  // Remove blocos redundantes de Detalhamento da reserva e Incluídos na reserva com fechamento seguro de tabela
  out = out.replace(/(?:<!--\s*DETALHAMENTO DA RESERVA\s*-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>\s*<p[^>]*>\s*Detalhamento da reserva\s*<\/p>[\s\S]*?<\/table>\s*<\/td>\s*<\/tr>/gi, '');
  out = out.replace(/(?:<!--\s*(?:PROTEÇÕES E EXTRAS|INCLUÍDOS NA RESERVA)\s*-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>\s*<p[^>]*>\s*Incluídos na reserva\s*<\/p>[\s\S]*?<\/table>\s*<\/td>\s*<\/tr>/gi, '');
  // Caso não tenha tabela aninhada
  out = out.replace(/(?:<!--\s*DETALHAMENTO DA RESERVA\s*-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>\s*<p[^>]*>\s*Detalhamento da reserva\s*<\/p>(?:(?!<\/td>)[\s\S])*?<\/td>\s*<\/tr>/gi, '');
  out = out.replace(/(?:<!--\s*(?:PROTEÇÕES E EXTRAS|INCLUÍDOS NA RESERVA)\s*-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>\s*<p[^>]*>\s*Incluídos na reserva\s*<\/p>(?:(?!<\/td>)[\s\S])*?<\/td>\s*<\/tr>/gi, '');
  out = out.replace(/\{\{#MOEDA_ESTRANGEIRA\}\}[\s\S]*?\{\{\/MOEDA_ESTRANGEIRA\}\}/gi, '');
  // Limpa quaisquer tags órfãs de diárias remanescentes
  out = out.replace(/\{\{\/?#?TEXTO_DIARIAS\}\}/gi, '');
  out = out.replace(/\{\{\/?#?QTD_DIARIAS\}\}/gi, '');
  return out;
}
