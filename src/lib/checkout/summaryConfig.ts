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
    showSuperTheftWaiver: boolean; // "Super Proteção contra Roubo / Furto" (Super Theft Waiver / STHW)
    showTheftWaiver: boolean; // "Proteção contra Roubo" (Theft Waiver / THW)
    showCollisionDamageWaiver: boolean; // "Proteção contra Danos / Colisão" (Collision Damage Waiver / CDW / SCDW)
    showGlassAndTyres: boolean; // "Vidros e Pneus" (Wheels & Windscreen / WWI)
    showPersonalAccident: boolean; // "Acidentes Pessoais" (PAI / SPPAI)
    showRoadsideAssistance: boolean; // "Assistência 24h em Viagem" (Roadside Assistance / RSA)
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
    showSuperTheftWaiver: true,
    showTheftWaiver: true,
    showCollisionDamageWaiver: true,
    showGlassAndTyres: true,
    showPersonalAccident: true,
    showRoadsideAssistance: true,
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
      showSuperTheftWaiver: raw.online?.showSuperTheftWaiver ?? def.online.showSuperTheftWaiver,
      showTheftWaiver: raw.online?.showTheftWaiver ?? def.online.showTheftWaiver,
      showCollisionDamageWaiver: raw.online?.showCollisionDamageWaiver ?? def.online.showCollisionDamageWaiver,
      showGlassAndTyres: raw.online?.showGlassAndTyres ?? def.online.showGlassAndTyres,
      showPersonalAccident: raw.online?.showPersonalAccident ?? def.online.showPersonalAccident,
      showRoadsideAssistance: raw.online?.showRoadsideAssistance ?? def.online.showRoadsideAssistance,
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
  cfg: CheckoutSummaryConfig = DEFAULT_CHECKOUT_SUMMARY_CONFIG,
  code?: string
): boolean {
  if (!cfg.online.enabled) return false;

  const lbl = (label || "").toLowerCase();
  const c = (code || "").toUpperCase();

  // 1. Diárias
  if (/di[aá]rias|basic rental/i.test(lbl)) {
    return cfg.online.showDailyRental;
  }

  // 2. Franquia Zero
  if (/franquia\s*zero/i.test(lbl) || c === "ZERO_EXCESS") {
    return cfg.online.showZeroExcess;
  }

  // 3. Super Proteção contra Roubo (Super Theft Waiver / STHW)
  if (
    c === "STHW" ||
    c === "SPTHW" ||
    /super\s*theft/i.test(lbl) ||
    /super.*roubo/i.test(lbl)
  ) {
    if (isZeroExcess) return false; // Parte integrante da Franquia Zero
    return cfg.online.showSuperTheftWaiver;
  }

  // 4. Proteção contra Roubo (Theft Waiver / THW)
  if (
    c === "THW" ||
    c === "THEFT" ||
    c === "TW" ||
    c === "TWC" ||
    /theft\s*(waiver|charge|protection)?/i.test(lbl) ||
    /contra\s*roubo/i.test(lbl)
  ) {
    if (isZeroExcess) return false; // Parte integrante da Franquia Zero
    return cfg.online.showTheftWaiver;
  }

  // 5. Proteção contra Danos / Colisão (Damage Waiver / CDW / SCDW / LDW)
  if (
    c === "CDW" ||
    c === "SCDW" ||
    c === "SPCDW" ||
    c === "LDW" ||
    c === "SLDW" ||
    /damage\s*(waiver|protection|charge)?/i.test(lbl) ||
    /collision/i.test(lbl) ||
    /contra\s*danos/i.test(lbl)
  ) {
    if (isZeroExcess) return false; // Parte integrante da Franquia Zero
    return cfg.online.showCollisionDamageWaiver;
  }

  // 6. Vidros e Pneus (Wheels & Windscreen / WWI)
  if (
    c === "WWI" ||
    c === "WIND" ||
    c === "TIRE" ||
    /vidro|pneu|windscreen|tyre|tire/i.test(lbl)
  ) {
    if (isZeroExcess) return false; // Parte integrante da Franquia Zero
    return cfg.online.showGlassAndTyres;
  }

  // 7. Acidentes Pessoais (Personal Accident / PAI / SPPAI)
  if (
    c === "PAI" ||
    c === "SPPAI" ||
    /acidente\s*pessoal|personal\s*accident/i.test(lbl)
  ) {
    if (isZeroExcess) return false; // Parte integrante da Franquia Zero
    return cfg.online.showPersonalAccident;
  }

  // 8. Assistência em Viagem 24h (Roadside Assistance / RSA)
  if (
    c === "RSA" ||
    /roadside|assist[eê]ncia\s*(24h|em\s*viagem|na\s*estrada)/i.test(lbl)
  ) {
    if (isZeroExcess) return false; // Parte integrante da Franquia Zero
    return cfg.online.showRoadsideAssistance;
  }

  // 9. Proteções básicas genéricas (quando NÃO for Franquia Zero)
  if (
    /prote[cç][aã]o contra (roubo|danos)/i.test(lbl) ||
    /accident & damage/i.test(lbl) ||
    /protection\s*package/i.test(lbl) ||
    /waiver/i.test(lbl)
  ) {
    if (isZeroExcess) return false; // Subsumido pela Franquia Zero
    return cfg.online.showBasicProtections;
  }

  // 10. Taxa de aeroporto
  if (/aeroporto|airport/i.test(lbl)) {
    return cfg.online.showAirportSurcharge;
  }

  // 11. Devolução em outra loja (One-way)
  if (/outra loja|one-way/i.test(lbl)) {
    return cfg.online.showOneWayCharge;
  }

  // 12. Sobretaxa de alta temporada
  if (/alta temporada|high season/i.test(lbl)) {
    return cfg.online.showHighSeasonSurcharge;
  }

  // 13. Taxas e licenças
  if (/licen[cç]as|taxas e licen[cç]as|licenses & fees/i.test(lbl)) {
    return cfg.online.showLicensesAndFees;
  }

  // 14. Demais itens
  return cfg.online.showOtherItems;
}
