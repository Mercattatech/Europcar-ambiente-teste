/**
 * xrsReservationSnapshot
 *
 * O XML da reserva no XRS (search.searchbyid → `reservation`) é a fonte da verdade do
 * que o cliente realmente contratou: proteções (insuranceList), acessórios
 * (equipmentList) e cotação (quote → moeda, câmbio, total).
 *
 * Este módulo lê esse XML e devolve os dados no MESMO formato que o checkout grava em
 * customerData (xrsInsurances / xrsEquipment), para o e-mail poder combinar as duas
 * origens sem duplicar.
 */
import { readBooking } from '@/lib/europcar/xrsClient';

// Nomes amigáveis (mesmo mapa usado na tela de seleção em reservation/vehicles)
export const INSURANCE_NAMES_PT: Record<string, string> = {
  WWI: 'Proteção de para-brisas, vidros, faróis e pneus', THW: 'Proteção contra Roubo (THW)',
  STHW: 'Super Proteção contra Roubo', SPTHW: 'Proteção Total contra Roubo',
  SPCDW: 'Proteção Total contra Danos e Acidentes', SCDW: 'Super Proteção contra Danos',
  RSA: 'Assistência na estrada 24h', PREMPRE: 'Proteção Plus', PREMPLUS: 'Proteção Premium Plus',
  PREMIUM: 'Proteção Premium', PAI: 'Proteção para acidentes pessoais', MEDIUM: 'Proteção Média',
  INTERIOR: 'Cobertura de danos ao interior', AWC: 'Cobertura de estradas não pavimentadas',
  CDW: 'Proteção contra Danos por Colisão', LDW: 'Proteção Básica', TPL: 'Responsabilidade Civil',
  PEP: 'Proteção de Efeitos Pessoais', PEC: 'Proteção de Pertences Pessoais', APP: 'Proteção de Aparência',
  SLDW: 'Proteção Básica Plus', SPAI: 'Proteção Plus para acidentes pessoais',
  XCU: 'Proteção Estendida', FP: 'Proteção contra Combustível',
};

/** Códigos de proteção "de verdade" (exclui taxas/sobretaxas que o XRS também lista). */
const PROTECTION_CODES = new Set([
  'TPL', 'LDW', 'CDW', 'THW', 'SCDW', 'SPCDW', 'STHW', 'SPTHW', 'MEDIUM', 'PREMIUM', 'PREMPRE',
  'PREMUP', 'PREMPLUS', 'RSA', 'APP', 'PAI', 'PEP', 'PEC', 'SLDW', 'WWI', 'SPAI', 'INTERIOR',
  'AWC', 'XCU', 'FP',
]);

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? 0 : n;
};
const toArray = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);

export interface XrsSnapshot {
  insurances: { code: string; name: string; priceBRL: number }[];
  equipment: { code: string; name: string; qty: number; priceBRL: number; totalBRL: number }[];
  /**
   * Franquia (excess) que sobra ao contratar cada proteção — atributo `excessWithPOM` do XRS
   * (moeda local) e `bkExcessWithPOM` (moeda de pagamento). 0/0 = franquia zero.
   * Só entra o código cujo atributo veio no XML.
   */
  excess?: Record<string, { local: number; brl: number }>;
  /** % de IVA (chargeLine chrgTy=00028), quando informado */
  vatPercent?: number;
  quote?: {
    /** Moeda local da estação (ex.: EUR) */
    currency?: string;
    /** Moeda em que o cliente paga (normalmente BRL) */
    bookingCurrency?: string;
    /** Total na moeda local */
    totalLocal: number;
    /** Total na moeda de pagamento */
    totalBooking: number;
    /** 1 unidade da moeda local = X na moeda de pagamento (ex.: 1 EUR = 6,18 BRL) */
    exchangeRate: number;
  };
}

/**
 * Extrai proteções, acessórios e cotação do nó `reservation` devolvido pelo XRS.
 * Tolerante a variações de formato (atributos em `$` ou direto no nó).
 */
export function extractSnapshotFromXrsReservation(raw: any): XrsSnapshot {
  const snapshot: XrsSnapshot = { insurances: [], equipment: [], excess: {} };
  if (!raw) return snapshot;

  // Item só entra se estiver "no total" (ou se o XRS não informar esse atributo).
  const isInTotal = (a: any) => {
    const inc = String(a.includedInTotal ?? '').toUpperCase();
    return inc === '' || inc === 'Y';
  };

  // ── Proteções ──────────────────────────────────────────────
  // No XML do XRS, quote.insuranceList traz TODAS as proteções DISPONÍVEIS para a categoria:
  //   type="I" → já incluída na tarifa (contratada, preço 0)
  //   type="O" → opcional; só foi CONTRATADA se existir uma chargeLine com auxK = código
  //   type="M" → obrigatória
  const insNodes = [
    ...toArray(raw.insuranceList?.insurance),
    ...toArray(raw.quote?.insuranceList?.insurance),
  ];
  const chargeCodes = new Set<string>();
  for (const cl of toArray(raw.quote?.chargeList?.chargeLine ?? raw.chargeList?.chargeLine)) {
    const ca = cl?.$ || cl || {};
    const k = String(ca.auxK || '').trim().toUpperCase();
    if (k) chargeCodes.add(k);
    if (String(ca.chrgTy || '') === '00028' && !snapshot.vatPercent) {
      const pct = num(ca.chrgPct);
      if (pct > 0 && pct <= 100) snapshot.vatPercent = pct;
    }
  }
  const NOT_PROTECTION = /FEE|TAX|VAT|^LAF$|^APF|^APT|^APS|^ASF|^YSC|^HS|RELOC|ONEWAY|DELIVER|COLLECT/;
  const seenIns = new Set<string>();
  for (const node of insNodes) {
    const a = node?.$ || node || {};
    const code = String(a.code || '').trim().toUpperCase();
    // Franquia remanescente (guardada p/ qualquer código listado; o e-mail só usa as contratadas)
    if (code && a.excessWithPOM !== undefined && !snapshot.excess![code]) {
      snapshot.excess![code] = { local: num(a.excessWithPOM), brl: num(a.bkExcessWithPOM) };
    }
    if (!code || seenIns.has(code)) continue;
    const type = String(a.type || '').toUpperCase();
    const isKnownProtection = PROTECTION_CODES.has(code);
    // Taxas/sobretaxas (aeroporto, alta temporada, LAF, one-way...) não são proteções
    if (!isKnownProtection && NOT_PROTECTION.test(code)) continue;
    // Contratada?
    const selected = type === 'I' || chargeCodes.has(code) || String(a.includedInTotal || '').toUpperCase() === 'Y';
    if (!selected) continue;
    // Código desconhecido só entra se foi de fato cobrado
    if (!isKnownProtection && !chargeCodes.has(code)) continue;
    if (!isInTotal(a)) continue;
    seenIns.add(code);
    snapshot.insurances.push({
      code,
      name: INSURANCE_NAMES_PT[code] || String(a.descr || '').trim() || code,
      priceBRL: type === 'I' ? 0 : (num(a.rentalPriceInBookingCurrencyAI) || num(a.priceInBookingCurrency)),
    });
  }

  // ── Acessórios / equipamentos ──────────────────────────────
  const eqNodes = [
    ...toArray(raw.equipmentList?.equipment),
    ...toArray(raw.quote?.equipmentList?.equipment),
  ];
  const seenEq = new Set<string>();
  for (const node of eqNodes) {
    const a = node?.$ || node || {};
    const code = String(a.code || '').trim().toUpperCase();
    if (!code || seenEq.has(code)) continue;
    const status = String(a.statusCode || '').toUpperCase();
    if (status === 'U') continue; // indisponível
    const qty = a.qty === undefined || a.qty === '' ? 1 : parseInt(String(a.qty), 10);
    if (!qty || qty <= 0) continue;
    if (!isInTotal(a)) continue;
    seenEq.add(code);
    snapshot.equipment.push({
      code,
      name: String(a.descr || '').trim() || code,
      qty,
      priceBRL: num(a.priceInBookingCurrency),
      totalBRL: num(a.rentalPriceInBookingCurrencyAI),
    });
  }

  // ── Cotação (moeda local × câmbio) ─────────────────────────
  const q = raw.quote?.$ || raw.quote;
  if (q) {
    const totalLocal = num(q.totalRateEstimate);
    const totalBooking = num(q.totalRateEstimateInBookingCurrency);
    const exch = num(q.exchangeRate) || (totalLocal > 0 && totalBooking > 0 ? totalBooking / totalLocal : 0);
    snapshot.quote = {
      currency: q.currency ? String(q.currency).toUpperCase() : undefined,
      bookingCurrency: (q.bookingCurrency || q.bookingCurrencyOfTotalRateEstimate) ? String(q.bookingCurrency || q.bookingCurrencyOfTotalRateEstimate).toUpperCase() : undefined,
      totalLocal,
      totalBooking,
      exchangeRate: exch,
    };
  }

  return snapshot;
}

/**
 * Lê a reserva no XRS e devolve o snapshot. Retorna null se o XRS falhar —
 * o e-mail então usa só os dados locais (nunca bloqueia o envio).
 */
export async function fetchXrsSnapshot(resNumber?: string | null): Promise<XrsSnapshot | null> {
  if (!resNumber) return null;
  try {
    const res = await readBooking(resNumber);
    if (!res.found || !res.raw) return null;
    const snap = extractSnapshotFromXrsReservation(res.raw);
    // readBooking já normaliza a quote; usa como reforço
    if (!snap.quote && res.quote) {
      const totalLocal = num(res.quote.totalRateEstimate);
      const totalBooking = num(res.quote.totalRateEstimateInBookingCurrency);
      snap.quote = {
        currency: res.quote.currency?.toUpperCase(),
        bookingCurrency: res.quote.bookingCurrency?.toUpperCase(),
        totalLocal,
        totalBooking,
        exchangeRate: totalLocal > 0 && totalBooking > 0 ? totalBooking / totalLocal : 0,
      };
    }
    console.log(
      `[xrsSnapshot] ${resNumber} → proteções: [${snap.insurances.map((i) => i.code).join(',')}] ` +
      `acessórios: [${snap.equipment.map((e) => `${e.code}x${e.qty}`).join(',')}] ` +
      `moeda: ${snap.quote?.currency || '?'} câmbio: ${snap.quote?.exchangeRate || '?'}`,
    );
    return snap;
  } catch (err: any) {
    console.warn(`[xrsSnapshot] Falha ao ler ${resNumber} no XRS:`, err?.message);
    return null;
  }
}
