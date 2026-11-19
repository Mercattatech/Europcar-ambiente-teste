/**
 * protectionPackages
 *
 * Agrupa as proteções que a XRS devolve no <insuranceList> em 3 pacotes
 * (Básica · Conforto · Premium), A CADA RESPOSTA da estação. Nada é inventado:
 *   - os itens (code/descr), franquia (excessWithPOM) e preços vêm do XML;
 *   - a MATRIZ só diz QUAIS códigos XRS formam cada nível (configurável no painel).
 * Se a estação não devolver os códigos de um nível, o pacote é omitido.
 *
 * Função pura, sem imports de servidor (usada no client component e nos testes).
 */

export interface XrsInsuranceRow {
  code: string;
  /** descr exatamente como veio no XML (sem tradução) */
  rawDescr?: string;
  /** descr já tratada pela tela (pode estar traduzida) — só fallback */
  descr?: string;
  type: string; // I | M | O
  /** true = veio do <insuranceList> (não do chargeList/taxList) */
  fromInsuranceList?: boolean;
  price?: number; // moeda local (total período, sem impostos)
  rentalPriceAI?: number; // moeda local, total período, com impostos
  rentalPriceInBookingCurrencyAI?: number; // BRL, total período, com impostos
  excessWithPOM?: number; // franquia (moeda local)
  bkExcessWithPOM?: number; // franquia (BRL)
}

export interface PackageMatrix {
  /** códigos type=I/M do insuranceList que NÃO são proteção (ex.: taxas) → não listar na Básica */
  basicExclude: string[];
  /** alternativas em ordem de preferência; vale a 1ª em que TODOS os códigos existem como opcionais */
  medium: string[][];
  premium: string[][];
}

export const DEFAULT_PACKAGE_MATRIX: PackageMatrix = {
  basicExclude: ['LAF'],
  medium: [['MEDIUM'], ['SCDW', 'WWI', 'PAI']],
  premium: [['PREMIUM'], ['SLDW', 'SPAI'], ['SER-PACK'], ['SER-PP']],
};

export interface PackageItem {
  code: string;
  /** descr do XML (se não houver, o código) */
  label: string;
}

export interface ProtectionPackage {
  id: 'basic' | 'medium' | 'premium';
  items: PackageItem[];
  /** linhas opcionais (type=O) que entram na reserva ao escolher o pacote */
  members: XrsInsuranceRow[];
  /** adicional do pacote (BRL, total do período). Básica = 0 */
  priceBRL: number;
  /** adicional em moeda local */
  priceLocal: number;
  /** maior franquia entre os itens do pacote (null = XML não informou) */
  excessBRL: number | null;
  excessLocal: number | null;
}

const up = (s: any) => String(s ?? '').trim().toUpperCase();
const num = (v: any) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

export function sanitizeMatrix(input: any): PackageMatrix {
  const lists = (v: any, fallback: string[][]): string[][] => {
    if (!Array.isArray(v)) return fallback;
    const out = v
      .map((alt: any) => (Array.isArray(alt) ? alt.map(up).filter(Boolean) : []))
      .filter((alt: string[]) => alt.length > 0);
    return out.length ? out : fallback;
  };
  return {
    basicExclude: Array.isArray(input?.basicExclude)
      ? input.basicExclude.map(up).filter(Boolean)
      : DEFAULT_PACKAGE_MATRIX.basicExclude,
    medium: lists(input?.medium, DEFAULT_PACKAGE_MATRIX.medium),
    premium: lists(input?.premium, DEFAULT_PACKAGE_MATRIX.premium),
  };
}

const toItem = (r: XrsInsuranceRow): PackageItem => ({
  code: up(r.code),
  label: (r.rawDescr || '').trim() || up(r.code),
});

const maxOrNull = (vals: number[], present: boolean) => (present ? Math.max(0, ...vals) : null);

/** Linhas do insuranceList que a Básica contém (incluídas/obrigatórias, exceto não-proteção). */
export function basicRows(rows: XrsInsuranceRow[], matrix: PackageMatrix = DEFAULT_PACKAGE_MATRIX): XrsInsuranceRow[] {
  const excl = new Set(matrix.basicExclude.map(up));
  return rows.filter(
    (r) => r.fromInsuranceList && (r.type === 'I' || r.type === 'M') && !excl.has(up(r.code)),
  );
}

function firstAlternative(rows: XrsInsuranceRow[], alts: string[][]): XrsInsuranceRow[] | null {
  const optional = rows.filter((r) => r.fromInsuranceList && r.type === 'O' && num(r.rentalPriceInBookingCurrencyAI) > 0);
  for (const alt of alts) {
    const found = alt.map((c) => optional.find((r) => up(r.code) === up(c)));
    if (found.every(Boolean)) return found as XrsInsuranceRow[];
  }
  return null;
}

function build(id: 'medium' | 'premium', members: XrsInsuranceRow[]): ProtectionPackage {
  return {
    id,
    items: members.map(toItem),
    members,
    priceBRL: members.reduce((s, r) => s + num(r.rentalPriceInBookingCurrencyAI), 0),
    priceLocal: members.reduce((s, r) => s + num(r.rentalPriceAI), 0),
    excessBRL: maxOrNull(members.map((r) => num(r.bkExcessWithPOM)), members.length > 0),
    excessLocal: maxOrNull(members.map((r) => num(r.excessWithPOM)), members.length > 0),
  };
}

export interface BuiltPackages {
  basic: ProtectionPackage | null;
  medium: ProtectionPackage | null;
  premium: ProtectionPackage | null;
}

/**
 * @param rows   linhas do insuranceList da estação (já parseadas, com fromInsuranceList/rawDescr)
 * @param matrix matriz de códigos por nível (padrão ou a configurada no painel)
 */
export function buildProtectionPackages(rows: XrsInsuranceRow[], matrix: PackageMatrix = DEFAULT_PACKAGE_MATRIX): BuiltPackages {
  const basic = basicRows(rows, matrix);
  const mediumM = firstAlternative(rows, matrix.medium);
  const premiumM = firstAlternative(rows, matrix.premium);
  return {
    basic: basic.length
      ? {
          id: 'basic',
          items: basic.map(toItem),
          members: [],
          priceBRL: 0,
          priceLocal: 0,
          excessBRL: maxOrNull(basic.map((r) => num(r.bkExcessWithPOM)), true),
          excessLocal: maxOrNull(basic.map((r) => num(r.excessWithPOM)), true),
        }
      : null,
    medium: mediumM ? build('medium', mediumM) : null,
    premium: premiumM ? build('premium', premiumM) : null,
  };
}

/** Códigos que algum pacote usa (para a lista de coberturas avulsas não repeti-los). */
export function packageMemberCodes(p: BuiltPackages): Set<string> {
  const s = new Set<string>();
  for (const pkg of [p.medium, p.premium]) for (const m of pkg?.members || []) s.add(up(m.code));
  return s;
}
