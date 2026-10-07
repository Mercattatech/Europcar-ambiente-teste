/**
 * pricingSnapshot
 *
 * Registro, no momento da venda, do valor NET capturado da API (XRS) e do markup aplicado.
 * Guardado dentro do JSON `LocalReservation.customerData.pricingSnapshot` (sem alterar o schema
 * do banco) e lido pela tela /painel/comissoes.
 *
 * - netBRL / netLocal / netCurrency: tarifa do veículo NET devolvida pelo XRS (bookReservation.quote)
 * - markupPercent: eto_margin_percent vigente no momento da reserva (só contratos ETO "Pagar agora")
 * - markupBRL: netBRL × markupPercent / 100 (quanto a Mercatta ganhou sobre o NET)
 *
 * Reservas antigas (sem snapshot) ganham uma ESTIMATIVA a partir do que foi salvo/cobrado.
 */
import prisma from '@/lib/prisma';
import { ETO_CID_LIQUIDO, ETO_CID_INTERNACIONAL } from '@/lib/europcar/xrsClient';

export interface PricingSnapshot {
  netBRL: number;
  netLocal: number | null;
  netCurrency: string | null;
  markupPercent: number;
  markupBRL: number;
  capturedAt: string;
  source: 'XRS_QUOTE' | 'ESTIMADO';
}

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '0').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const round2 = (v: number) => Math.round(v * 100) / 100;

export function isEtoContract(contractID: any): boolean {
  const c = String(contractID || '');
  return c === String(ETO_CID_LIQUIDO) || c === String(ETO_CID_INTERNACIONAL);
}

/** Markup (%) configurado no painel (/painel/margem). 0 se o banco estiver indisponível. */
export async function readEtoMarkupPercent(): Promise<number> {
  try {
    const cfg = await prisma.contentBlock.findUnique({ where: { key: 'eto_margin_percent' } });
    const p = parseFloat(cfg?.value_ptBR || '0');
    return isNaN(p) || p < 0 ? 0 : p;
  } catch {
    return 0;
  }
}

/**
 * Monta o snapshot a partir da cotação do XRS (nó `quote` do bookReservation).
 * Retorna null se a cotação não trouxe valor.
 */
export function buildPricingSnapshot(params: {
  quoteNode: any;
  contractID: any;
  markupPercent: number;
}): PricingSnapshot | null {
  const q = params.quoteNode || {};
  const netLocal = num(q.totalRateEstimate);
  const netBRL = num(q.totalRateEstimateInBookingCurrency) || netLocal;
  if (netBRL <= 0) return null;

  const markupPercent = isEtoContract(params.contractID) ? Math.max(0, params.markupPercent || 0) : 0;
  return {
    netBRL: round2(netBRL),
    netLocal: netLocal > 0 ? round2(netLocal) : null,
    netCurrency: q.currency ? String(q.currency).toUpperCase() : null,
    markupPercent,
    markupBRL: round2(netBRL * markupPercent / 100),
    capturedAt: new Date().toISOString(),
    source: 'XRS_QUOTE',
  };
}

/**
 * Lê o snapshot salvo; para reservas antigas devolve uma estimativa
 * (NET = cotação regravada no car; markup = cobrado online − proteções − acessórios − NET, só ETO).
 */
export function resolvePricingSnapshot(customerData: any, amountInCents: number | null | undefined): PricingSnapshot | null {
  const cd = customerData || {};
  if (cd.pricingSnapshot && num(cd.pricingSnapshot.netBRL) > 0) {
    const s = cd.pricingSnapshot;
    return {
      netBRL: num(s.netBRL),
      netLocal: s.netLocal != null ? num(s.netLocal) : null,
      netCurrency: s.netCurrency || null,
      markupPercent: num(s.markupPercent),
      markupBRL: num(s.markupBRL),
      capturedAt: s.capturedAt || '',
      source: 'XRS_QUOTE',
    };
  }

  const booking = cd.booking || {};
  const car = booking.car || {};
  const netLocal = num(car.totalRateEstimate);
  const netBRL = num(car.totalRateEstimateInBookingCurrency) || netLocal;
  if (netBRL <= 0) return null;

  let markupBRL = 0;
  const paid = (amountInCents || 0) / 100;
  if (isEtoContract(booking.contractID) && paid > 0) {
    const ins = (Array.isArray(cd.xrsInsurances) ? cd.xrsInsurances : [])
      .reduce((s: number, i: any) => s + num(i.priceBRL), 0);
    const equip = (Array.isArray(cd.xrsEquipment) ? cd.xrsEquipment : [])
      .reduce((s: number, e: any) => s + (num(e.totalBRL) > 0 ? num(e.totalBRL) : num(e.priceBRL)) * (e.qty || 1), 0);
    const implied = paid - ins - equip - netBRL;
    // Diferenças pequenas (arredondamento/câmbio) não são markup
    markupBRL = implied > netBRL * 0.005 ? implied : 0;
  }

  return {
    netBRL: round2(netBRL),
    netLocal: netLocal > 0 ? round2(netLocal) : null,
    netCurrency: car.currency ? String(car.currency).toUpperCase() : null,
    markupPercent: markupBRL > 0 ? round2((markupBRL / netBRL) * 100) : 0,
    markupBRL: round2(markupBRL),
    capturedAt: '',
    source: 'ESTIMADO',
  };
}
