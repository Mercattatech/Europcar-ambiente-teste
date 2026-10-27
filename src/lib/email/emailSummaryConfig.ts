/**
 * Configuração do Resumo e Seções dos E-mails (editável no /painel/resumo-email)
 *
 * Permite ao administrador ligar/desligar variáveis do resumo de caixa ({{RESUMO_CAIXA}})
 * e blocos regulatórios/informativos (01, 02, 03, 04, checklist, etc.) nos e-mails.
 */

export interface EmailSummaryConfig {
  version: 1;

  // ─── Resumo de Caixa ({{RESUMO_CAIXA}}) ──────────────────────────────────────
  cashSummary: {
    online: {
      enabled: boolean;
      title: string; // Padrão: "Pagar on-line"
      showSubtotalBRL: boolean;
      showSubtotalLocal: boolean;
      showDailyRental: boolean;
      showZeroExcess: boolean;
      showBasicProtections: boolean;
      showAirportSurcharge: boolean;
      showOneWayCharge: boolean;
      showHighSeasonSurcharge: boolean;
      showLicensesAndFees: boolean;
      showOtherItems: boolean;
    };
    counter: {
      enabled: boolean;
      title: string; // Padrão: "A pagar no balcão"
      showSubtotalBRL: boolean;
      showSubtotalLocal: boolean;
      showItemsList: boolean;
      showNotice: boolean;
    };
    total: {
      enabled: boolean;
      title: string; // Padrão: "Valor total"
      showBRL: boolean;
      showLocal: boolean;
    };
  };

  // ─── Seções de Texto e Regulamentos do E-mail ─────────────────────────────────
  sections: {
    // Bloco "Franquia, caução e cobranças"
    franchiseBlock: boolean;
    franchiseList: boolean; // Franquia das proteções contratadas
    whatIsNotCovered: boolean; // O que a proteção não cobre
    depositNotice: boolean; // Caução (pré-autorização no cartão)
    otherChargesNotice: boolean; // Outras cobranças no balcão
    returnNotice: boolean; // Devolução e tolerância

    // Bloco Documentos
    documentAlert: boolean; // "Na retirada apresente este e-mail..."

    // Blocos numerados
    section01: boolean; // 01 Sua reserva - Informações importantes
    section02: boolean; // 02 Horário e comparecimento - Prazo para retirada
    section03: boolean; // 03 Checklist - Principais itens para retirada
    section04: boolean; // 04 Regras aplicáveis - Termos e condições

    // Suporte
    supportLink: boolean; // "Dúvidas? Acesse europcar.com.br/reservas..."
  };
}

/** Configuração padrão idêntica aos e-mails aprovados */
export const DEFAULT_EMAIL_SUMMARY_CONFIG: EmailSummaryConfig = {
  version: 1,
  cashSummary: {
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
  },
  sections: {
    franchiseBlock: true,
    franchiseList: true,
    whatIsNotCovered: true,
    depositNotice: true,
    otherChargesNotice: true,
    returnNotice: true,
    documentAlert: true,
    section01: true,
    section02: true,
    section03: true,
    section04: true,
    supportLink: true,
  },
};

/**
 * Normaliza qualquer objeto salvo no ContentBlock, preenchendo campos ausentes
 * com os valores padrão para assegurar compatibilidade e segurança.
 */
export function normalizeEmailSummaryConfig(raw: any): EmailSummaryConfig {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_EMAIL_SUMMARY_CONFIG;
  }

  const def = DEFAULT_EMAIL_SUMMARY_CONFIG;
  const cs = raw.cashSummary || {};
  const on = cs.online || {};
  const ct = cs.counter || {};
  const tot = cs.total || {};
  const sec = raw.sections || {};

  return {
    version: 1,
    cashSummary: {
      online: {
        enabled: on.enabled ?? def.cashSummary.online.enabled,
        title: (on.title || def.cashSummary.online.title).trim(),
        showSubtotalBRL: on.showSubtotalBRL ?? def.cashSummary.online.showSubtotalBRL,
        showSubtotalLocal: on.showSubtotalLocal ?? def.cashSummary.online.showSubtotalLocal,
        showDailyRental: on.showDailyRental ?? def.cashSummary.online.showDailyRental,
        showZeroExcess: on.showZeroExcess ?? def.cashSummary.online.showZeroExcess,
        showBasicProtections: on.showBasicProtections ?? def.cashSummary.online.showBasicProtections,
        showAirportSurcharge: on.showAirportSurcharge ?? def.cashSummary.online.showAirportSurcharge,
        showOneWayCharge: on.showOneWayCharge ?? def.cashSummary.online.showOneWayCharge,
        showHighSeasonSurcharge: on.showHighSeasonSurcharge ?? def.cashSummary.online.showHighSeasonSurcharge,
        showLicensesAndFees: on.showLicensesAndFees ?? def.cashSummary.online.showLicensesAndFees,
        showOtherItems: on.showOtherItems ?? def.cashSummary.online.showOtherItems,
      },
      counter: {
        enabled: ct.enabled ?? def.cashSummary.counter.enabled,
        title: (ct.title || def.cashSummary.counter.title).trim(),
        showSubtotalBRL: ct.showSubtotalBRL ?? def.cashSummary.counter.showSubtotalBRL,
        showSubtotalLocal: ct.showSubtotalLocal ?? def.cashSummary.counter.showSubtotalLocal,
        showItemsList: ct.showItemsList ?? def.cashSummary.counter.showItemsList,
        showNotice: ct.showNotice ?? def.cashSummary.counter.showNotice,
      },
      total: {
        enabled: tot.enabled ?? def.cashSummary.total.enabled,
        title: (tot.title || def.cashSummary.total.title).trim(),
        showBRL: tot.showBRL ?? def.cashSummary.total.showBRL,
        showLocal: tot.showLocal ?? def.cashSummary.total.showLocal,
      },
    },
    sections: {
      franchiseBlock: sec.franchiseBlock ?? def.sections.franchiseBlock,
      franchiseList: sec.franchiseList ?? def.sections.franchiseList,
      whatIsNotCovered: sec.whatIsNotCovered ?? def.sections.whatIsNotCovered,
      depositNotice: sec.depositNotice ?? def.sections.depositNotice,
      otherChargesNotice: sec.otherChargesNotice ?? def.sections.otherChargesNotice,
      returnNotice: sec.returnNotice ?? def.sections.returnNotice,
      documentAlert: sec.documentAlert ?? def.sections.documentAlert,
      section01: sec.section01 ?? def.sections.section01,
      section02: sec.section02 ?? def.sections.section02,
      section03: sec.section03 ?? def.sections.section03,
      section04: sec.section04 ?? def.sections.section04,
      supportLink: sec.supportLink ?? def.sections.supportLink,
    },
  };
}

/**
 * Remove do HTML do e-mail qualquer seção desativada pelo administrador.
 */
export function filterEmailHtmlByConfig(html: string, cfg: EmailSummaryConfig): string {
  if (!html) return html;
  let out = html;

  // 1. Bloco Franquia inteiro
  if (!cfg.sections.franchiseBlock) {
    out = out.replace(/(?:<!--\s*FRANQUIA[\s\S]*?-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>[\s\S]*?Franquia,\s*caução\s*e\s*cobranças[\s\S]*?<\/tr>/gi, "");
  } else {
    // Sub-itens do bloco Franquia
    if (!cfg.sections.franchiseList) {
      out = out.replace(/<p[^>]*>Franquia das proteções contratadas<\/p>\s*<p[^>]*>[\s\S]*?<\/p>/gi, "");
    }
    if (!cfg.sections.whatIsNotCovered) {
      out = out.replace(/<p[^>]*>O que a proteção não cobre<\/p>\s*<p[^>]*>[\s\S]*?<\/p>/gi, "");
    }
    if (!cfg.sections.depositNotice) {
      out = out.replace(/<p[^>]*>Caução \(pré-autorização no cartão de crédito\)<\/p>\s*<p[^>]*>[\s\S]*?<\/p>/gi, "");
    }
    if (!cfg.sections.otherChargesNotice) {
      out = out.replace(/<p[^>]*>Outras cobranças no balcão ou após a devolução<\/p>\s*<p[^>]*>[\s\S]*?<\/p>/gi, "");
    }
    if (!cfg.sections.returnNotice) {
      out = out.replace(/<p[^>]*>Devolução e tolerância<\/p>\s*<p[^>]*>[\s\S]*?<\/p>/gi, "");
    }
  }

  // 2. Alerta Documentos
  if (!cfg.sections.documentAlert) {
    out = out.replace(/(?:<!--\s*ALERTA\s*DOCUMENTOS\s*-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>[\s\S]*?Na retirada apresente este e-mail[\s\S]*?<\/tr>/gi, "");
  }

  // 3. Seções numeradas (01, 02, 03, 04)
  if (!cfg.sections.section01) {
    out = out.replace(/<tr>\s*<td[^>]*class="px"[^>]*>[\s\S]*?01\s+Sua reserva[\s\S]*?<\/tr>/gi, "");
  }
  if (!cfg.sections.section02) {
    out = out.replace(/<tr>\s*<td[^>]*class="px"[^>]*>[\s\S]*?02\s+Horário e comparecimento[\s\S]*?<\/tr>/gi, "");
  }
  if (!cfg.sections.section03) {
    out = out.replace(/<tr>\s*<td[^>]*class="px"[^>]*>[\s\S]*?03\s+Checklist[\s\S]*?<\/tr>/gi, "");
  }
  if (!cfg.sections.section04) {
    out = out.replace(/<tr>\s*<td[^>]*class="px"[^>]*>[\s\S]*?04\s+Regras aplicáveis[\s\S]*?<\/tr>/gi, "");
  }

  // 4. Suporte
  if (!cfg.sections.supportLink) {
    out = out.replace(/(?:<!--\s*SUPORTE\s*-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>[\s\S]*?Dúvidas\?\s*Acesse[\s\S]*?<\/tr>/gi, "");
  }

  return out;
}
