/**
 * etoPricing
 *
 * Regra única de preço da tarifa "Pagar Agora" (ETO / cartão) frente ao preço público do
 * balcão (POA). Usada pela tela de veículos, pelo checkout (via etoMarginPercent efetivo)
 * e pela consulta de disponibilidade, para que todos vejam exatamente o mesmo preço.
 *
 * Regras:
 *  1. Preço desejado = NET da ETO × (1 + markup do painel).
 *  2. O preço ETO nunca pode passar de POA × (1 − desconto mínimo do painel).
 *     Se o markup desejado estourar esse teto, o markup é reduzido automaticamente.
 *  3. Piso: nunca vende abaixo do NET (markup efetivo >= 0). Se nem no NET o desconto mínimo
 *     é atingido, vende no NET e `metMinDiscount` = false (a tela troca a etiqueta de
 *     "X% mais barato" por "Isento de IOF").
 */

export const ETO_MIN_DISCOUNT_KEY = 'eto_min_discount_percent';
export const DEFAULT_ETO_MIN_DISCOUNT_PERCENT = 6;

export interface EtoPricingInput {
  /** Total NET (sem markup) da tarifa ETO, na mesma moeda de `poaTotal`. */
  etoNet: number;
  /** Total da tarifa pública POA (balcão), na mesma moeda de `etoNet`. */
  poaTotal: number;
  /** Markup configurado no painel (%). */
  markupPercent: number;
  /** Desconto mínimo exigido do cartão sobre o POA (%). */
  minDiscountPercent: number;
}

export interface EtoPricingResult {
  /** Markup (%) realmente aplicado sobre o NET, já limitado pelo desconto mínimo e pelo piso 0. */
  effectiveMarkupPercent: number;
  /** Multiplicador para aplicar ao NET (BRL e moeda local, que compartilham o mesmo câmbio). */
  multiplier: number;
  /** Preço final na moeda de entrada. */
  price: number;
  /** Desconto real do cartão sobre o POA (%), sem arredondar. 0 se POA indisponível. */
  discountPercent: number;
  /** true quando o desconto mínimo foi atingido (ou não há POA para comparar). */
  metMinDiscount: boolean;
  /** true quando o markup do painel foi reduzido para respeitar o desconto mínimo. */
  capped: boolean;
}

const num = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza o desconto mínimo vindo do banco/API (0–95). Valor inválido → padrão (6%). */
export function normalizeMinDiscountPercent(raw: any): number {
  if (raw === null || raw === undefined || raw === '') return DEFAULT_ETO_MIN_DISCOUNT_PERCENT;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ETO_MIN_DISCOUNT_PERCENT;
  return Math.min(95, n);
}

export function computeEtoPricing(input: EtoPricingInput): EtoPricingResult {
  const etoNet = num(input.etoNet);
  const poaTotal = num(input.poaTotal);
  const markup = Math.max(0, num(input.markupPercent));
  const minDiscount = Math.max(0, num(input.minDiscountPercent));

  if (etoNet <= 0) {
    return { effectiveMarkupPercent: markup, multiplier: 1 + markup / 100, price: 0, discountPercent: 0, metMinDiscount: true, capped: false };
  }

  const desired = etoNet * (1 + markup / 100);
  let price = desired;
  let capped = false;

  if (poaTotal > 0 && minDiscount > 0) {
    // floor em centavos: garante que, depois de arredondado para exibição, o desconto não fique abaixo do mínimo
    const ceiling = Math.floor(poaTotal * (1 - minDiscount / 100) * 100) / 100;
    if (desired > ceiling) {
      price = Math.max(ceiling, etoNet); // piso: nunca abaixo do NET
      capped = true;
    }
  }

  const multiplier = price / etoNet;
  const discountPercent = poaTotal > 0 ? (1 - price / poaTotal) * 100 : 0;
  const metMinDiscount = poaTotal <= 0 || minDiscount <= 0 || discountPercent + 1e-9 >= minDiscount;

  return {
    effectiveMarkupPercent: Math.round((multiplier - 1) * 100 * 10000) / 10000,
    multiplier,
    price,
    discountPercent,
    metMinDiscount,
    capped,
  };
}
