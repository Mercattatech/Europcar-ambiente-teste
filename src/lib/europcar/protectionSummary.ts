/**
 * protectionSummary
 *
 * Fonte única (cliente + servidor) para saber QUAIS proteções o cliente contratou.
 * Sem imports de servidor (prisma/XRS) — pode ser usado no painel (client component).
 *
 * ⚠️ A "Proteção Premium — Franquia Zero" NÃO é um item de proteção (insurance) na reserva:
 *    é um CONTRATO diferente (ETO Internacional, CID 56935495). O checkout grava isso em
 *    booking.zeroExcess = true e booking.contractID = '56935495'. Por isso ela não aparece
 *    em booking.extras / xrsInsurances e precisa ser detectada à parte.
 */

/** CIDs de contrato com franquia zero (ETO Internacional). */
export const ZERO_EXCESS_CIDS = ['56935495'];

export const ZERO_EXCESS_LABEL = 'Proteção Premium — Franquia Zero';

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

/**
 * true quando a reserva foi feita com a Proteção Premium (Franquia Zero).
 * booking.zeroExcess é a fonte principal; contractID cobre reservas em que o flag não foi gravado.
 */
export function isZeroExcessBooking(booking: any): boolean {
  if (!booking || typeof booking !== 'object') return false;
  if (typeof booking.zeroExcess === 'boolean') return booking.zeroExcess;
  if (booking.zeroExcess === 'true') return true;
  return ZERO_EXCESS_CIDS.includes(String(booking.contractID || booking.car?.contractID || ''));
}

export interface ContractedProtection {
  code: string;
  name: string;
  qty: number;
  priceBRL: number;
  /** true = embutida na tarifa (ex.: franquia zero), sem preço separado */
  includedInRate?: boolean;
}

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? 0 : n;
};

/**
 * Lista consolidada das proteções contratadas, lendo todas as origens do customerData:
 * franquia zero (contrato) → xrsInsurances (topo e booking) → booking.extras (exceto acessórios).
 */
export function listContractedProtections(customerData: any): ContractedProtection[] {
  const cd = customerData || {};
  const booking = cd.booking || {};
  const out = new Map<string, ContractedProtection>();

  if (isZeroExcessBooking(booking)) {
    out.set('ZERO_EXCESS', { code: 'ZERO_EXCESS', name: ZERO_EXCESS_LABEL, qty: 1, priceBRL: 0, includedInRate: true });
  }

  for (const list of [cd.xrsInsurances, booking.xrsInsurances]) {
    if (!Array.isArray(list)) continue;
    for (const i of list) {
      const code = String(i?.code || '').trim();
      if (!code || out.has(code)) continue;
      out.set(code, { code, name: i?.name || INSURANCE_NAMES_PT[code] || code, qty: num(i?.qty) || 1, priceBRL: num(i?.priceBRL) });
    }
  }

  // booking.extras mistura proteções e acessórios: ignora os códigos que são acessórios
  const equipCodes = new Set<string>(
    [...(Array.isArray(cd.xrsEquipment) ? cd.xrsEquipment : []), ...(Array.isArray(booking.xrsEquipment) ? booking.xrsEquipment : [])]
      .map((e: any) => String(e?.code || '')),
  );
  const extras = booking.extras && typeof booking.extras === 'object' ? booking.extras : {};
  for (const [code, rawQty] of Object.entries(extras)) {
    const qty = num(rawQty);
    if (qty <= 0 || equipCodes.has(code) || out.has(code)) continue;
    out.set(code, { code, name: INSURANCE_NAMES_PT[code] || code, qty, priceBRL: 0 });
  }

  return [...out.values()];
}
