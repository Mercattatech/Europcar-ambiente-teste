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
  /** Se a reserva possui Proteção Premium / Franquia Zero */
  isZeroExcess?: boolean;
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
  /** Se a reserva possui Proteção Premium / Franquia Zero */
  isZeroExcess?: boolean;
  /** Códigos de extras opcionais adicionados (equipamentos, proteções extras) que NÃO devem receber markup */
  extraCodes?: Set<string> | string[];
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

const EQUIPMENT_CHRGTY = new Set(['00018', '00020', '00021', '00022', '00023']);
const OPTIONAL_INSURANCE_CODES = new Set([
  'WWI', 'PAI', 'SPPAI', 'RSA', 'PEP', 'APP', 'INTERIOR', 'AWC',
  'SCDW', 'SPCDW', 'STHW', 'SPTHW', 'MEDIUM', 'PREMPRE', 'PREMPLUS', 'PREMIUM'
]);

/**
 * Identifica se uma linha de cobrança do XRS é um EXTRA ADICIONADO opcional
 * (equipamentos como cadeira de bebê, GPS, ou proteções opcionais adicionadas).
 * Extras adicionados NUNCA devem receber markup comercial.
 */
export function isExtraChargeLine(line: SplitLine, isZeroExcess = false): boolean {
  const chrgTy = String(line.chrgTy || '');
  const auxK = String(line.auxK || '').toUpperCase();
  const desc = String(line.originalDesc || '').toLowerCase();

  // Itens padrão do pacote básico do veículo NUNCA são extras:
  // Diárias (00001), IVA (00028), Aeroporto (00024), One-way (00030), LAF (00090), HSS (00546),
  // Snow chains na Itália (00700 / SNOW-IT), Ecological fee (00621 / ECOLOGIC), Jovem condutor (00070), Km livre (00048)
  if (
    chrgTy === '00001' || chrgTy === '00028' || chrgTy === '00024' ||
    chrgTy === '00030' || chrgTy === '00090' || chrgTy === '00546' ||
    chrgTy === '00700' || auxK === 'SNOW-IT' || chrgTy === '00621' ||
    auxK === 'ECOLOGIC' || chrgTy === '00070' || chrgTy === '00048' ||
    chrgTy === '00006' || chrgTy === '00008'
  ) {
    return false;
  }

  // Se a tarifa for Franquia Zero (contractID 56935495), a Franquia Zero é a tarifa básica do carro
  if (isZeroExcess && (auxK === 'ZERO_EXCESS' || chrgTy === 'ZERO_EXCESS' || /franquia\s*zero|premium\s*protection/i.test(desc))) {
    return false;
  }

  // Equipamentos opcionais
  if (EQUIPMENT_CHRGTY.has(chrgTy)) return true;
  if (/child|baby|booster|cadeira|assento|gps|navigation|rack|skirack|wi-fi|wifi/i.test(desc)) return true;

  // Proteções opcionais adicionadas
  if (OPTIONAL_INSURANCE_CODES.has(auxK)) {
    if (isZeroExcess && (auxK === 'SCDW' || auxK === 'SPCDW' || auxK === 'STHW' || auxK === 'SPTHW')) {
      return false; // Parte do pacote Franquia Zero
    }
    return true;
  }

  return false;
}

/**
 * Aplica markup às linhas e ao subtotal, garantindo que a soma das linhas
 * exibidas seja exatamente o subtotal exibido (resíduo de arredondamento
 * vai para a maior linha base). Linhas marcadas como extras NUNCA recebem markup.
 */
function applyMarkup(
  lines: SplitLine[],
  target: number,
  key: 'priceBRL' | 'priceLocal',
  factor: number,
  isExtraPredicate?: (line: SplitLine) => boolean
): number {
  const targetRounded = round2(target);
  if (lines.length === 0) return targetRounded;

  const baseLines = isExtraPredicate ? lines.filter((l) => !isExtraPredicate(l)) : lines;
  const extraLines = isExtraPredicate ? lines.filter((l) => isExtraPredicate(l)) : [];
  const extraSum = extraLines.reduce((s, l) => s + l[key], 0);
  const targetBase = round2(targetRounded - extraSum);

  if (baseLines.length === 0) return targetRounded;

  let sum = 0;
  let maxIdx = 0;
  baseLines.forEach((l, i) => {
    l[key] = round2(l[key] * factor);
    sum += l[key];
    if (Math.abs(l[key]) > Math.abs(baseLines[maxIdx][key])) maxIdx = i;
  });
  const residual = round2(targetBase - sum);
  if (residual !== 0) baseLines[maxIdx][key] = round2(baseLines[maxIdx][key] + residual);
  return targetRounded;
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

  // ── Proteção Premium (Franquia Zero): oculta as proteções básicas (CDW/THW) e adiciona Franquia Zero ──
  const isZeroExcess = Boolean(
    options.isZeroExcess ?? (
      attrsOf(reservationNode).zeroExcess === 'true' ||
      attrsOf(reservationNode).zeroExcess === true ||
      attrsOf(reservationNode).contractID === '56935495' ||
      attrsOf(reservationNode?.quote).contractID === '56935495' ||
      attrsOf(reservationNode?.rate).contractID === '56935495'
    )
  );

  if (isZeroExcess) {
    const isOtherProtection = (item: IncludedItem) => {
      if (item.code === 'ZERO_EXCESS') return false;
      const c = (item.code || '').toUpperCase();
      if (
        c === 'CDW' || c === 'THW' || c === 'LDW' || c === 'SLDW' ||
        c === 'SPCDW' || c === 'SCDW' || c === 'WWI' || c === 'PAI' ||
        c === 'SPPAI' || c === 'STHW' || c === 'SPTHW' || c === 'TW' ||
        c === 'TWC' || c === 'THEFT' || c === 'RSA' || c === 'WIND' || c === 'TIRE'
      ) {
        return true;
      }
      const lbl = item.label || '';
      if (/theft/i.test(lbl)) return true; // Pegar SUPER THEFT WAIVER CHARGE, Theft Waiver, etc.
      if (/waiver/i.test(lbl)) return true;
      if (/roubo|furto/i.test(lbl)) return true;
      if (/protection\s*package/i.test(lbl)) return true;
      if (/pacote\s*de\s*prote[cç][aã]o/i.test(lbl)) return true;
      if (/premium\s*protection/i.test(lbl) && !/franquia\s*zero/i.test(lbl)) return true;
      if (/prote[cç][aã]o\s*contra\s*(roubo|danos|furto)/i.test(lbl)) return true;
      if (/accident\s*&\s*damage/i.test(lbl)) return true;
      if (/damage\s*(waiver|protection|charge)?/i.test(lbl)) return true;
      if (/collision\s*(damage|waiver)?/i.test(lbl)) return true;
      if (/vidro|pneu|windscreen|tyre|tire/i.test(lbl)) return true;
      if (/acidente\s*pessoal|personal\s*accident/i.test(lbl)) return true;
      if (/roadside\s*assistance|assist[eê]ncia\s*(24h|em\s*viagem|na\s*estrada)/i.test(lbl)) return true;
      return false;
    };

    const filterInc = (list: IncludedItem[]) => list.filter((i) => !isOtherProtection(i));

    const newOnlineInc = filterInc(onlineIncluded);
    const premiumItem: IncludedItem = {
      code: 'ZERO_EXCESS',
      chrgTy: 'ZERO_EXCESS',
      label: 'Proteção Premium — Franquia Zero',
      side: 'online',
      excessLocal: null,
      excessBRL: null,
    };
    newOnlineInc.unshift(premiumItem);
    onlineIncluded.length = 0;
    onlineIncluded.push(...newOnlineInc);

    const newCounterInc = filterInc(counterIncluded);
    counterIncluded.length = 0;
    counterIncluded.push(...newCounterInc);

    const newInc = filterInc(included);
    newInc.unshift(premiumItem);
    included.length = 0;
    included.push(...newInc);
  }

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
  // No modelo Europcar Tour Operator (B2B):
  // O markup comercial (ex: 25%) incide ESTRITAMENTE sobre o pacote base do veículo (diárias + taxas obrigatórias).
  // Extras adicionados (equipamentos, proteções opcionais) NUNCA recebem markup comercial (margem 0%).
  // O valor no balcão é fixo/exato em moeda local (definido pela Europcar local, ex: taxas e extras locais).
  // O que é pago ao Tour Operator (on-line) é a soma: (Base com Margem - Balcão Base) + Extras On-line (sem markup).
  const extraCodesSet = options.extraCodes instanceof Set
    ? options.extraCodes
    : Array.isArray(options.extraCodes)
    ? new Set(options.extraCodes.map((c) => String(c).toUpperCase()))
    : null;

  const isExtraLine = (line: SplitLine): boolean => {
    if (extraCodesSet) {
      const aux = (line.auxK || '').toUpperCase();
      const ty = (line.chrgTy || '').toUpperCase();
      if (extraCodesSet.has(aux) || extraCodesSet.has(ty)) return true;
    }
    return isExtraChargeLine(line, isZeroExcess);
  };

  const onlineExtraLines = (online?.lines || []).filter(isExtraLine);
  const counterExtraLines = (counter?.lines || []).filter(isExtraLine);

  const onlineExtraNetBRL = round2(onlineExtraLines.reduce((s, l) => s + l.priceBRL, 0));
  const onlineExtraNetLocal = round2(onlineExtraLines.reduce((s, l) => s + l.priceLocal, 0));
  const counterExtraNetBRL = round2(counterExtraLines.reduce((s, l) => s + l.priceBRL, 0));
  const counterExtraNetLocal = round2(counterExtraLines.reduce((s, l) => s + l.priceLocal, 0));

  const totalExtraNetBRL = round2(onlineExtraNetBRL + counterExtraNetBRL);
  const totalExtraNetLocal = round2(onlineExtraNetLocal + counterExtraNetLocal);

  // Custo líquido do pacote base do veículo (sem extras adicionados)
  const baseNetBRL = Math.max(0, round2((totalRateEstimateBRL ?? netTotalBRL) - totalExtraNetBRL));
  const baseNetLocal = Math.max(0, round2((totalRateEstimateLocal ?? netTotalLocal) - totalExtraNetLocal));

  // Balcão base (taxas obrigatórias locais do carro, ex: aeroporto e snow chains na Itália)
  const baseCounterBRL = Math.max(0, round2((counter?.netSubtotalBRL ?? 0) - counterExtraNetBRL));
  const baseCounterLocal = Math.max(0, round2((counter?.netSubtotalLocal ?? 0) - counterExtraNetLocal));

  // On-line base líquido
  const baseOnlineNetBRL = Math.max(0, round2((online?.netSubtotalBRL ?? 0) - onlineExtraNetBRL));
  const baseOnlineNetLocal = Math.max(0, round2((online?.netSubtotalLocal ?? 0) - onlineExtraNetLocal));

  if (online && markupPct !== 0) {
    const factor = 1 + markupPct / 100;

    // Markup incide SOMENTE sobre o pacote base do veículo
    const targetBaseTotalBRL = round2(baseNetBRL * factor);
    const targetBaseTotalLocal = round2(baseNetLocal * factor);

    // O on-line base é a diferença do pacote base com margem menos o balcão base
    const targetBaseOnlineBRL = Math.max(0, round2(targetBaseTotalBRL - baseCounterBRL));
    const targetBaseOnlineLocal = Math.max(0, round2(targetBaseTotalLocal - baseCounterLocal));

    // Extras adicionados entram no on-line a 0% de margem (valor líquido/facial exato)
    const targetOnlineBRL = round2(targetBaseOnlineBRL + onlineExtraNetBRL);
    const targetOnlineLocal = round2(targetBaseOnlineLocal + onlineExtraNetLocal);

    const effectiveFactorBRL = baseOnlineNetBRL > 0 ? (targetBaseOnlineBRL / baseOnlineNetBRL) : factor;
    const effectiveFactorLocal = baseOnlineNetLocal > 0 ? (targetBaseOnlineLocal / baseOnlineNetLocal) : factor;

    online.subtotalBRL = applyMarkup(online.lines, targetOnlineBRL, 'priceBRL', effectiveFactorBRL, isExtraLine);
    online.subtotalLocal = applyMarkup(online.lines, targetOnlineLocal, 'priceLocal', effectiveFactorLocal, isExtraLine);
  }

  const totalBRL = round2((online?.subtotalBRL ?? 0) + (counter?.subtotalBRL ?? 0));
  const totalLocal = round2((online?.subtotalLocal ?? 0) + (counter?.subtotalLocal ?? 0));

  return {
    version: 1,
    resNumber,
    localCurrency,
    bookingCurrency,
    isPriceSecret,
    isZeroExcess,
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
