/**
 * Configuração do Resumo do Checkout (editável no /painel/resumo-checkout)
 *
 * Permite ao administrador ligar/desligar variáveis e seções do resumo financeiro
 * do checkout, respeitando rigorosamente as regras de BA (on-line) vs sem BA (balcão).
 */

export interface CheckoutSummaryConfig {
  version: 1;

  // ─── Bloco Pagar On-line (linhas com BA) ───────────────────────────────────
  online: {
    enabled: boolean;
    title: string; // Padrão: "Pagar on-line"
    showSubtotalBRL: boolean;
    showSubtotalLocal: boolean;
    showDailyRental: boolean; // Linha "Diárias"
    showZeroExcess: boolean; // Linha "Proteção Premium — Franquia Zero" (quando contratada)
    showBasicProtections: boolean; // "Proteção contra danos / roubo" (quando NÃO contratada franquia zero)
    showAirportSurcharge: boolean; // "Taxa de aeroporto"
    showOneWayCharge: boolean; // "Taxa de devolução em outra loja"
    showHighSeasonSurcharge: boolean; // "Sobretaxa de alta temporada"
    showLicensesAndFees: boolean; // "Taxas e licenças"
    showOtherItems: boolean; // Demais itens mapeados ou extras
    showInstallmentsNotice: boolean; // Aviso de parcelamento (ex: até 6x sem juros)
  };

  // ─── Bloco A Pagar no Balcão (linhas sem BA) ───────────────────────────────
  counter: {
    enabled: boolean;
    title: string; // Padrão: "A pagar no balcão"
    showSubtotalBRL: boolean;
    showSubtotalLocal: boolean;
    showItemsList: boolean; // Linhas dos itens a pagar no balcão
    showNotice: boolean; // "Este valor será cobrado na retirada do veículo..."
  };

  // ─── Bloco Valor Total ───────────────────────────────────────────────────────
  total: {
    enabled: boolean;
    title: string; // Padrão: "Valor total"
    showBRL: boolean;
    showLocal: boolean;
  };
}

/** Configuração padrão idêntica ao comportamento atual do site */
export const DEFAULT_CHECKOUT_SUMMARY_CONFIG: CheckoutSummaryConfig = {
  version: 1,
  online: {
    enabled: true,
    title: "Pagar on-line",
    showSubtotalBRL: true,
    showSubtotalLocal: true,
    showDailyRental: true,
    showZeroExcess: true,
    showBasicProtections: true,
    showAirportSurcharge: true,
    showOneWayCharge: true,
    showHighSeasonSurcharge: true,
    showLicensesAndFees: true,
    showOtherItems: true,
    showInstallmentsNotice: true,
  },
  counter: {
    enabled: true,
    title: "A pagar no balcão",
    showSubtotalBRL: true,
    showSubtotalLocal: true,
    showItemsList: true,
    showNotice: true,
  },
  total: {
    enabled: true,
    title: "Valor total",
    showBRL: true,
    showLocal: true,
  },
};

/**
 * Normaliza qualquer objeto salvo no ContentBlock, preenchendo novos campos
 * com os valores padrão para garantir 100% de estabilidade.
 */
export function normalizeCheckoutSummaryConfig(raw: any): CheckoutSummaryConfig {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_CHECKOUT_SUMMARY_CONFIG;
  }

  const def = DEFAULT_CHECKOUT_SUMMARY_CONFIG;
  return {
    version: 1,
    online: {
      enabled: raw.online?.enabled ?? def.online.enabled,
      title: (raw.online?.title || def.online.title).trim(),
      showSubtotalBRL: raw.online?.showSubtotalBRL ?? def.online.showSubtotalBRL,
      showSubtotalLocal: raw.online?.showSubtotalLocal ?? def.online.showSubtotalLocal,
      showDailyRental: raw.online?.showDailyRental ?? def.online.showDailyRental,
      showZeroExcess: raw.online?.showZeroExcess ?? def.online.showZeroExcess,
      showBasicProtections: raw.online?.showBasicProtections ?? def.online.showBasicProtections,
      showAirportSurcharge: raw.online?.showAirportSurcharge ?? def.online.showAirportSurcharge,
      showOneWayCharge: raw.online?.showOneWayCharge ?? def.online.showOneWayCharge,
      showHighSeasonSurcharge: raw.online?.showHighSeasonSurcharge ?? def.online.showHighSeasonSurcharge,
      showLicensesAndFees: raw.online?.showLicensesAndFees ?? def.online.showLicensesAndFees,
      showOtherItems: raw.online?.showOtherItems ?? def.online.showOtherItems,
      showInstallmentsNotice: raw.online?.showInstallmentsNotice ?? def.online.showInstallmentsNotice,
    },
    counter: {
      enabled: raw.counter?.enabled ?? def.counter.enabled,
      title: (raw.counter?.title || def.counter.title).trim(),
      showSubtotalBRL: raw.counter?.showSubtotalBRL ?? def.counter.showSubtotalBRL,
      showSubtotalLocal: raw.counter?.showSubtotalLocal ?? def.counter.showSubtotalLocal,
      showItemsList: raw.counter?.showItemsList ?? def.counter.showItemsList,
      showNotice: raw.counter?.showNotice ?? def.counter.showNotice,
    },
    total: {
      enabled: raw.total?.enabled ?? def.total.enabled,
      title: (raw.total?.title || def.total.title).trim(),
      showBRL: raw.total?.showBRL ?? def.total.showBRL,
      showLocal: raw.total?.showLocal ?? def.total.showLocal,
    },
  };
}

/**
 * Determina se uma linha ou item do resumo on-line deve ser exibido com base na configuração.
 */
export function isOnlineItemVisible(
  label: string,
  isZeroExcess: boolean,
  cfg: CheckoutSummaryConfig = DEFAULT_CHECKOUT_SUMMARY_CONFIG
): boolean {
  if (!cfg.online.enabled) return false;

  const lbl = (label || "").toLowerCase();

  // Diárias
  if (/di[aá]rias|basic rental/i.test(lbl)) {
    return cfg.online.showDailyRental;
  }

  // Franquia Zero
  if (/franquia zero/i.test(lbl)) {
    return cfg.online.showZeroExcess;
  }

  // Proteções básicas (apenas quando não for Franquia Zero)
  if (/prote[cç][aã]o contra (roubo|danos)/i.test(lbl) || /accident & damage/i.test(lbl) || /theft protection/i.test(lbl)) {
    if (isZeroExcess) return false;
    return cfg.online.showBasicProtections;
  }

  // Taxa de aeroporto
  if (/aeroporto|airport/i.test(lbl)) {
    return cfg.online.showAirportSurcharge;
  }

  // Devolução em outra loja (One-way)
  if (/outra loja|one-way/i.test(lbl)) {
    return cfg.online.showOneWayCharge;
  }

  // Sobretaxa de alta temporada
  if (/alta temporada|high season/i.test(lbl)) {
    return cfg.online.showHighSeasonSurcharge;
  }

  // Taxas e licenças
  if (/licen[cç]as|taxas e licen[cç]as|licenses & fees/i.test(lbl)) {
    return cfg.online.showLicensesAndFees;
  }

  // Demais itens
  return cfg.online.showOtherItems;
}
