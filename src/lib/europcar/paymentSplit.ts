/**
 * paymentSplit — Regra de pagamento: on-line (conta empresarial) × balcão
 *
 * A decisão é feita POR LINHA DE COBRANÇA, olhando o <payer> de cada <chargeLine>:
 *   - <payer ba="..."> com `ba` não vazio → PAGO ON-LINE (conta empresarial)
 *   - <payer> sem `ba` (normalmente dvrName) → PAGO NO BALCÃO (condutor, na retirada)
 *
 * Regras:
 *   - Nenhum código de conta é fixado aqui: qualquer `ba` não vazio conta.
 *   - `isPrepaid` NÃO é usado na decisão.
 *   - Linhas de IVA (00028) seguem o próprio payer — sem rateio.
 *   - Totais de cada lado vêm do <payerList> (dueToPayInBookingCurrency / dueToPayInRentingCurrency).
 *   - Detalhamento vem das <chargeLine> agrupadas pela regra acima.
 *   - Validação: soma das linhas de cada lado × payerList daquele lado (tolerância 0,01).
 *     Divergência → vale o payerList + log de alerta com o resNumber.
 *   - Soma dos dois lados × totalRateEstimateInBookingCurrency / InRentingCurrency.
 *   - Linhas 0,00 não entram nos blocos; proteções a 0,00 vão para "Incluso" com a franquia
 *     (excessWithPOM / bkExcessWithPOM do <insuranceList> type="I").
 *
 * Módulo PURO (sem imports): roda no browser (Step 3 / checkout), no servidor
 * (bookReservation / e-mail) e nos testes (`node --test`).
 *
 * Entrada: o nó `reservation` já parseado pelo xml2js ({ explicitArray: false }),
 * em que os atributos ficam em `$`. Objetos com atributos "achatados" também são aceitos.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PaymentSide = 'online' | 'counter';

export interface SplitLine {
  /** chrgTy do XRS (ex.: 00001, 00024, 00028) */
  chrgTy: string;
  /** auxK do XRS (ex.: CDW, THW, código da conta) */
  auxK: string;
  /** chrgTyDesc original do XRS */
  originalDesc: string;
  /** Descrição em PT-BR (ou a original, se não mapeada) */
  label: string;
  /** true quando a descrição foi traduzida pelo mapa */
  mapped: boolean;
  side: PaymentSide;
  /** Valor em BRL (priceInBookingCurrency) — já com markup no bloco on-line, se houver */
  priceBRL: number;
  /** Valor na moeda da locação (price) — já com markup no bloco on-line, se houver */
  priceLocal: number;
}

export interface IncludedItem {
  code: string;
  chrgTy: string;
  label: string;
  side: PaymentSide;
  /** Franquia na moeda da locação (excessWithPOM) — null quando não há franquia */
  excessLocal: number | null;
  /** Franquia em BRL (bkExcessWithPOM) — null quando não há franquia */
  excessBRL: number | null;
}

export interface SplitBlock {
  side: PaymentSide;
  /** Linhas cobradas com valor > 0 */
  lines: SplitLine[];
  /** Itens inclusos (0,00) que pertencem a este lado (com BA no on-line, sem BA no balcão) */
  included: IncludedItem[];
  /** Subtotal exibido/cobrado (payerList, ou soma das linhas se payerList ausente) — com markup no on-line */
  subtotalBRL: number;
  subtotalLocal: number;
  /** Subtotal SEM markup (valor do XRS) */
  netSubtotalBRL: number;
  netSubtotalLocal: number;
  /** Soma das chargeLines do lado (sem markup) */
  linesSumBRL: number;
  linesSumLocal: number;
  /** Valor do payerList para este lado (null se ausente) */
  payerListBRL: number | null;
  payerListLocal: number | null;
  /** true quando a soma das linhas diverge do payerList (> 0,01) */
  mismatch: boolean;
}

export interface PaymentSplit {
  version: 1;
  resNumber: string | null;
  /** Moeda da locação (ex.: EUR) */
  localCurrency: string;
  /** Moeda da reserva (ex.: BRL) */
  bookingCurrency: string;
  isPriceSecret: boolean;
  /** Markup aplicado ao bloco on-line (percentual, ex.: 10 = 10%) */
  onlineMarkupPercent: number;
  online: SplitBlock | null;
  counter: SplitBlock | null;
  included: IncludedItem[];
  /** Total (on-line com markup + balcão) */
  totalBRL: number;
  totalLocal: number;
  /** Total do XRS (sem markup) */
  netTotalBRL: number;
  netTotalLocal: number;
  totalRateEstimateBRL: number | null;
  totalRateEstimateLocal: number | null;
  /** true quando a soma dos dois lados (sem markup) bate com o totalRateEstimate */
  totalMatches: boolean;
  /** Mensagens de alerta (divergências / payerList ausente) */
  alerts: string[];
  /** Descrições do XRS sem tradução no mapa */
  unmappedDescriptions: string[];
}

export interface PaymentSplitOptions {
  /** Markup percentual aplicado SOMENTE ao bloco on-line (ex.: margem ETO do painel). Default 0. */
  onlineMarkupPercent?: number;
  /** resNumber para os logs quando o nó não tem (ex.: cotação). */
  resNumber?: string | null;
  /** Logger (default: console). Use `null` para silenciar. */
  logger?: Pick<Console, 'warn'> | null;
}

// ─── Constantes ─────────────────────────────────────────────────────────────

export const AMOUNT_TOLERANCE = 0.01;

/** Mapa chrgTyDesc (maiúsculas) → PT-BR */
export const CHARGE_DESC_PT: Record<string, string> = {
  'BASIC RENTAL': 'Diárias',
  'VAT': 'Impostos (IVA)',
  'AIRPORT SURCHARGE': 'Taxa de aeroporto',
  'ONE-WAY CHARGE': 'Taxa de devolução em outra loja',
  'ACCIDENT & DAMAGE PROTECTION': 'Proteção contra danos',
  'THEFT PROTECTION': 'Proteção contra roubo',
  'LICENSES & FEES': 'Taxas e licenças',
  'HIGH SEASON SURCHARGE': 'Sobretaxa de alta temporada',
};

/** chrgTy que nunca vão para a lista "Incluso" mesmo a 0,00 (IVA, diárias, km livre) */
const NEVER_INCLUDED_CHRGTY = new Set(['00001', '00028', '00048']);

const CURRENCY_SYMBOL: Record<string, string> = {
  BRL: 'R$',
  EUR: '€',
  USD: 'US$',
  GBP: '£',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function attrsOf(node: any): Record<string, any> {
  if (!node || typeof node !== 'object') return {};
  return node.$ && typeof node.$ === 'object' ? node.$ : node;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: any): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: any): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** `ba` preenchido (qualquer valor não vazio) → conta empresarial */
export function hasBusinessAccount(payerAttrs: Record<string, any> | null | undefined): boolean {
  const ba = payerAttrs?.ba;
  return typeof ba === 'string' ? ba.trim() !== '' : ba !== undefined && ba !== null && String(ba).trim() !== '';
}

/** Traduz chrgTyDesc para PT-BR. Não mapeado → texto original. */
export function translateChargeDesc(desc: string): { label: string; mapped: boolean } {
  const key = (desc || '').trim().toUpperCase();
  const pt = CHARGE_DESC_PT[key];
  if (pt) return { label: pt, mapped: true };
  return { label: (desc || '').trim(), mapped: false };
}

function formatNumberPtBR(value: number): string {
  const v = round2(Math.abs(value));
  const [int, dec] = v.toFixed(2).split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${value < 0 ? '-' : ''}${intFmt},${dec}`;
}

/** R$ 1.391,92 */
export function formatBRL(value: number): string {
  return `R$ ${formatNumberPtBR(value)}`;
}

/** € 239,47 (ou "<SÍMBOLO/CÓDIGO> 0,00" para outras moedas) */
export function formatMoney(value: number, currency: string): string {
  const cur = (currency || '').toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur] || cur || '';
  return `${symbol} ${formatNumberPtBR(value)}`.trim();
}

/** "R$ 1.391,92 (€ 239,47)" — BRL em destaque, moeda local entre parênteses */
export function formatBRLWithLocal(brl: number, local: number, localCurrency: string): string {
  const cur = (localCurrency || '').toUpperCase();
  if (!cur || cur === 'BRL') return formatBRL(brl);
  return `${formatBRL(brl)} (${formatMoney(local, cur)})`;
}

/**
 * Aplica markup às linhas e ao subtotal, garantindo que a soma das linhas
 * exibidas seja exatamente o subtotal exibido (resíduo de arredondamento
 * vai para a maior linha).
 */
function applyMarkup(lines: SplitLine[], subtotal: number, key: 'priceBRL' | 'priceLocal', factor: number): number {
  const target = round2(subtotal * factor);
  if (lines.length === 0) return target;
  let sum = 0;
  let maxIdx = 0;
  lines.forEach((l, i) => {
    l[key] = round2(l[key] * factor);
    sum += l[key];
    if (Math.abs(l[key]) > Math.abs(lines[maxIdx][key])) maxIdx = i;
  });
  const residual = round2(target - sum);
  if (residual !== 0) lines[maxIdx][key] = round2(lines[maxIdx][key] + residual);
  return target;
}

// ─── Função principal ───────────────────────────────────────────────────────

/**
 * Calcula a divisão on-line × balcão a partir do nó `reservation` do XRS.
 * Retorna null quando não há <quote>/<chargeList> para analisar.
 */
export function computePaymentSplit(reservationNode: any, options: PaymentSplitOptions = {}): PaymentSplit | null {
  const logger = options.logger === undefined ? console : options.logger;
  const markupPct = Number.isFinite(options.onlineMarkupPercent as number) ? Number(options.onlineMarkupPercent) : 0;

  const resAttrs = attrsOf(reservationNode);
  const resNumber: string | null = (resAttrs.resNumber && String(resAttrs.resNumber)) || options.resNumber || null;
  const resTag = resNumber ? `resNumber=${resNumber}` : 'resNumber=(cotação)';

  const quote = reservationNode?.quote;
  if (!quote) return null;
  const q = attrsOf(quote);

  const rawLines = asArray(quote?.chargeList?.chargeLine);
  if (rawLines.length === 0) return null;

  const localCurrency = String(q.rentingCurrencyOfTotalRateEstimate || q.currency || '').toUpperCase();
  const bookingCurrency = String(q.bookingCurrencyOfTotalRateEstimate || 'BRL').toUpperCase();
  const isPriceSecret = String(q.isPriceSecret || '').toUpperCase() === 'Y';

  const alerts: string[] = [];
  const unmapped = new Set<string>();
  const warn = (msg: string) => {
    alerts.push(msg);
    logger?.warn(`[paymentSplit] ⚠️ ${resTag} — ${msg}`);
  };

  // ── Franquias do insuranceList type="I" (por código) ──
  const excessByCode = new Map<string, { local: number; brl: number }>();
  for (const ins of asArray(quote?.insuranceList?.insurance)) {
    const a = attrsOf(ins);
    if (String(a.type || '').toUpperCase() !== 'I') continue;
    const code = String(a.code || '').toUpperCase();
    if (!code) continue;
    excessByCode.set(code, { local: num(a.excessWithPOM), brl: num(a.bkExcessWithPOM) });
  }

  // ── Linhas de cobrança ──
  const onlineLines: SplitLine[] = [];
  const counterLines: SplitLine[] = [];
  const onlineIncluded: IncludedItem[] = [];
  const counterIncluded: IncludedItem[] = [];
  const included: IncludedItem[] = [];
  const includedKeys = new Set<string>();
  let onlineSumBRL = 0, onlineSumLocal = 0, counterSumBRL = 0, counterSumLocal = 0;
  let hasOnline = false, hasCounter = false;

  for (const raw of rawLines) {
    const a = attrsOf(raw);
    const payerAttrs = attrsOf(raw?.payer);
    const side: PaymentSide = hasBusinessAccount(payerAttrs) ? 'online' : 'counter';
    const chrgTy = String(a.chrgTy || '');
    const auxK = String(a.auxK || '').toUpperCase();
    const originalDesc = String(a.chrgTyDesc || '').trim();
    const { label, mapped } = translateChargeDesc(originalDesc);
    if (!mapped && originalDesc && !unmapped.has(originalDesc)) {
      unmapped.add(originalDesc);
      logger?.warn(`[paymentSplit] ℹ️ ${resTag} — chrgTyDesc sem tradução: "${originalDesc}" (chrgTy=${chrgTy})`);
    }

    const priceBRL = num(a.priceInBookingCurrency);
    const priceLocal = num(a.price);

    if (side === 'online') { onlineSumBRL += priceBRL; onlineSumLocal += priceLocal; }
    else { counterSumBRL += priceBRL; counterSumLocal += priceLocal; }

    const isZero = Math.abs(priceBRL) < 0.005 && Math.abs(priceLocal) < 0.005;
    if (isZero) {
      // Proteções/taxas incluídas a 0,00 → distribuídas no bloco on-line (com BA) ou balcão (sem BA)
      const isBasicRental = chrgTy === '00001' || originalDesc.toUpperCase().startsWith('BASIC RENTAL');
      if (!NEVER_INCLUDED_CHRGTY.has(chrgTy) && !isBasicRental && label) {
        const key = `${side}:${label.toUpperCase()}`;
        if (!includedKeys.has(key)) {
          includedKeys.add(key);
          const exc = auxK ? excessByCode.get(auxK) : undefined;
          const item: IncludedItem = {
            code: auxK || chrgTy,
            chrgTy,
            label,
            side,
            excessLocal: exc && exc.local > 0 ? exc.local : null,
            excessBRL: exc && exc.brl > 0 ? exc.brl : null,
          };
          if (side === 'online') onlineIncluded.push(item);
          else counterIncluded.push(item);
          included.push(item);
        }
      }
      continue;
    }

    const line: SplitLine = { chrgTy, auxK, originalDesc, label, mapped, side, priceBRL, priceLocal };
    if (side === 'online') { onlineLines.push(line); hasOnline = true; }
    else { counterLines.push(line); hasCounter = true; }
  }

  // ── payerList ──
  const payers = asArray(quote?.payerList?.payer);
  let plOnlineBRL: number | null = null, plOnlineLocal: number | null = null;
  let plCounterBRL: number | null = null, plCounterLocal: number | null = null;
  for (const p of payers) {
    const a = attrsOf(p);
    const brl = num(a.dueToPayInBookingCurrency);
    const local = num(a.dueToPayInRentingCurrency ?? a.dueToPay);
    if (hasBusinessAccount(a)) {
      plOnlineBRL = (plOnlineBRL ?? 0) + brl;
      plOnlineLocal = (plOnlineLocal ?? 0) + local;
    } else {
      plCounterBRL = (plCounterBRL ?? 0) + brl;
      plCounterLocal = (plCounterLocal ?? 0) + local;
    }
  }
  if (payers.length === 0) warn('payerList ausente na resposta do XRS — usando a soma das chargeLines.');

  const buildBlock = (
    side: PaymentSide,
    lines: SplitLine[],
    blockIncluded: IncludedItem[],
    sumBRL: number,
    sumLocal: number,
    plBRL: number | null,
    plLocal: number | null,
  ): SplitBlock => {
    const linesSumBRL = round2(sumBRL);
    const linesSumLocal = round2(sumLocal);
    const sideName = side === 'online' ? 'on-line (ba)' : 'balcão (dvrName)';
    let mismatch = false;
    if (plBRL !== null && Math.abs(linesSumBRL - plBRL) > AMOUNT_TOLERANCE + 1e-9) {
      mismatch = true;
      warn(`soma das chargeLines do lado ${sideName} (${formatBRL(linesSumBRL)}) diverge do payerList (${formatBRL(plBRL)}). Exibindo o valor do payerList.`);
    }
    if (plLocal !== null && Math.abs(linesSumLocal - plLocal) > AMOUNT_TOLERANCE + 1e-9) {
      mismatch = true;
      warn(`soma das chargeLines do lado ${sideName} (${formatMoney(linesSumLocal, localCurrency)}) diverge do payerList (${formatMoney(plLocal, localCurrency)}). Exibindo o valor do payerList.`);
    }
    const netSubtotalBRL = round2(plBRL ?? linesSumBRL);
    const netSubtotalLocal = round2(plLocal ?? linesSumLocal);
    return {
      side,
      lines,
      included: blockIncluded,
      subtotalBRL: netSubtotalBRL,
      subtotalLocal: netSubtotalLocal,
      netSubtotalBRL,
      netSubtotalLocal,
      linesSumBRL,
      linesSumLocal,
      payerListBRL: plBRL === null ? null : round2(plBRL),
      payerListLocal: plLocal === null ? null : round2(plLocal),
      mismatch,
    };
  };

  // Bloco existe se houver linha com valor OU valor no payerList daquele lado OU itens inclusos
  const showOnline = hasOnline || (plOnlineBRL ?? 0) > AMOUNT_TOLERANCE || onlineIncluded.length > 0;
  const showCounter = hasCounter || (plCounterBRL ?? 0) > AMOUNT_TOLERANCE || counterIncluded.length > 0;

  const online = showOnline ? buildBlock('online', onlineLines, onlineIncluded, onlineSumBRL, onlineSumLocal, plOnlineBRL, plOnlineLocal) : null;
  const counter = showCounter ? buildBlock('counter', counterLines, counterIncluded, counterSumBRL, counterSumLocal, plCounterBRL, plCounterLocal) : null;

  // ── Conferência com o totalRateEstimate (valores do XRS, sem markup) ──
  const netTotalBRL = round2((online?.netSubtotalBRL ?? 0) + (counter?.netSubtotalBRL ?? 0));
  const netTotalLocal = round2((online?.netSubtotalLocal ?? 0) + (counter?.netSubtotalLocal ?? 0));
  const totalRateEstimateBRL = numOrNull(q.totalRateEstimateInBookingCurrency);
  const totalRateEstimateLocal = numOrNull(q.totalRateEstimateInRentingCurrency ?? q.totalRateEstimate);
  let totalMatches = true;
  if (totalRateEstimateBRL !== null && Math.abs(netTotalBRL - totalRateEstimateBRL) > AMOUNT_TOLERANCE + 1e-9) {
    totalMatches = false;
    warn(`on-line + balcão (${formatBRL(netTotalBRL)}) diverge do totalRateEstimateInBookingCurrency (${formatBRL(totalRateEstimateBRL)}).`);
  }
  if (totalRateEstimateLocal !== null && Math.abs(netTotalLocal - totalRateEstimateLocal) > AMOUNT_TOLERANCE + 1e-9) {
    totalMatches = false;
    warn(`on-line + balcão (${formatMoney(netTotalLocal, localCurrency)}) diverge do totalRateEstimateInRentingCurrency (${formatMoney(totalRateEstimateLocal, localCurrency)}).`);
  }

  // ── Markup no bloco on-line (ex.: margem ETO) ──
  if (online && markupPct !== 0) {
    const factor = 1 + markupPct / 100;
    online.subtotalBRL = applyMarkup(online.lines, online.netSubtotalBRL, 'priceBRL', factor);
    online.subtotalLocal = applyMarkup(online.lines, online.netSubtotalLocal, 'priceLocal', factor);
  }

  const totalBRL = round2((online?.subtotalBRL ?? 0) + (counter?.subtotalBRL ?? 0));
  const totalLocal = round2((online?.subtotalLocal ?? 0) + (counter?.subtotalLocal ?? 0));

  return {
    version: 1,
    resNumber,
    localCurrency,
    bookingCurrency,
    isPriceSecret,
    onlineMarkupPercent: markupPct,
    online,
    counter,
    included,
    totalBRL,
    totalLocal,
    netTotalBRL,
    netTotalLocal,
    totalRateEstimateBRL,
    totalRateEstimateLocal,
    totalMatches,
    alerts,
    unmappedDescriptions: [...unmapped],
  };
}

/** Aviso padrão do bloco "A pagar no balcão" */
export function counterNotice(localCurrency: string): string {
  const cur = (localCurrency || '').toUpperCase() || 'moeda local';
  return `Este valor será cobrado na retirada do veículo, em ${cur}, no cartão do condutor.`;
}

const CURRENCY_NAME_PT: Record<string, string> = {
  CHF: 'francos suíços (CHF)', EUR: 'euros (EUR)', USD: 'dólares americanos (USD)', GBP: 'libras esterlinas (GBP)',
  CAD: 'dólares canadenses (CAD)', AUD: 'dólares australianos (AUD)', BRL: 'reais (BRL)', AED: 'dirhams (AED)',
  CLP: 'pesos chilenos (CLP)', UYU: 'pesos uruguaios (UYU)', ARS: 'pesos argentinos (ARS)', ZAR: 'rands sul-africanos (ZAR)',
  NZD: 'dólares neozelandeses (NZD)', NOK: 'coroas norueguesas (NOK)', SEK: 'coroas suecas (SEK)', DKK: 'coroas dinamarquesas (DKK)',
};

/** Frase do bloco "Valor total" (igual ao resumo de caixa do checkout) */
export function counterCurrencyNotice(localCurrency: string): string {
  const cur = (localCurrency || '').toUpperCase();
  const name = CURRENCY_NAME_PT[cur] || cur || 'moeda local';
  return `O pagamento da retirada será realizado em ${name}, no balcão da Europcar.`;
}

/** Texto da franquia de um item "Incluso" (ex.: "franquia € 1.900,00") */
export function includedExcessText(item: IncludedItem, localCurrency: string): string {
  if (item.excessLocal !== null) {
    return `franquia ${formatMoney(item.excessLocal, localCurrency)}`;
  }
  if (item.excessBRL !== null) {
    return `franquia ${formatBRL(item.excessBRL)}`;
  }
  return '';
}
