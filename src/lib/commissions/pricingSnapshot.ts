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
 * Reservas antigas (sem snapshot) NÃO recebem estimativa: o NET real deve ser buscado no XRS
 * (buildBackfillSnapshot). Até lá aparecem como "Sem NET real" e não geram comissão.
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
  source: 'XRS_QUOTE' | 'XRS_BACKFILL' | 'EUROPCAR_EXTRATO' | 'NOMINAL_FALLBACK' | 'SEM_MARKUP';
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
 * Markup (%) efetivamente aplicado ao preço da reserva. O site calcula um markup por veículo
 * (reduzido quando o markup do painel estouraria o desconto mínimo sobre o POA) e o envia em
 * booking.etoMarginPercent. Aqui nunca aceitamos valor acima do configurado no painel.
 */
export async function resolveEffectiveMarkupPercent(bookingData: any): Promise<number> {
  const configured = await readEtoMarkupPercent();
  const fromBooking = Number(bookingData?.etoMarginPercent);
  if (Number.isFinite(fromBooking) && fromBooking >= 0) return Math.min(fromBooking, configured);
  return configured;
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
 * Lê o snapshot real salvo (na venda ou reconsultado no XRS). Nunca estima:
 * - ETO sem snapshot → null ("Sem NET real", aguarda reconsulta no XRS).
 * - Contratos sem markup (POA etc.) → NET da cotação salva, markup 0 (não há markup a estimar).
 */
export function resolvePricingSnapshot(
  customerData: any,
  _amountInCents?: number | null,
  _opts?: { configuredMarkupPercent?: number }
): PricingSnapshot | null {
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
      source: s.source === 'XRS_BACKFILL' || s.source === 'EUROPCAR_EXTRATO' ? s.source : 'XRS_QUOTE',
    };
  }

  const booking = cd.booking || {};
  if (isEtoContract(booking.contractID)) return null; // ETO sem NET real: nada de estimativa

  const car = booking.car || {};
  const netLocal = num(car.totalRateEstimate);
  const netBRL = num(car.totalRateEstimateInBookingCurrency) || netLocal;
  if (netBRL <= 0) return null;
  return {
    netBRL: round2(netBRL),
    netLocal: netLocal > 0 ? round2(netLocal) : null,
    netCurrency: car.currency ? String(car.currency).toUpperCase() : null,
    markupPercent: 0,
    markupBRL: 0,
    capturedAt: '',
    source: 'SEM_MARKUP',
  };
}

const AIRPORT_CODES = ['APF', 'APT', 'AIRPORTFEE', 'APS', 'ASF', 'APF2', 'APTF', 'STF'];

/** Cobranças pagas no balcão (sobretaxa de aeroporto etc.) — mesma regra do checkout. */
export function counterChargesBRL(booking: any): number {
  const list = Array.isArray(booking?.quoteInsurances) ? booking.quoteInsurances : [];
  return list
    .filter((i: any) => {
      if (i.paidBy === 'counter' || i.paidBy === 'business') return true;
      return !i.paidBy && AIRPORT_CODES.includes(String(i.code || '').toUpperCase());
    })
    .reduce((sum: number, i: any) => {
      const v = num(i.rentalPriceInBookingCurrencyAI) > 0
        ? num(i.rentalPriceInBookingCurrencyAI)
        : (num(i.priceInBookingCurrency) > 0 ? num(i.priceInBookingCurrency) : num(i.price));
      return sum + v;
    }, 0);
}


/**
 * Reconstrói o snapshot de uma reserva ANTIGA a partir da reconsulta no XRS (search.searchbyid):
 * NET = cotação atual da reserva no XRS; markup = (valor cobrado online + sobretaxa paga no balcão) − NET.
 * Devolve { error } quando o resultado não é plausível (nunca grava valor duvidoso).
 */
export function buildBackfillSnapshot(
  customerData: any,
  amountInCents: number | null | undefined,
  quote: { totalRateEstimate?: string; totalRateEstimateInBookingCurrency?: string; currency?: string } | undefined
): PricingSnapshot | { error: string } {
  const cd = customerData || {};
  const booking = cd.booking || {};
  if (!isEtoContract(booking.contractID)) return { error: 'Reserva não é ETO (sem markup)' };
  if (!quote) return { error: 'XRS não devolveu cotação' };

  const netLocal = num(quote.totalRateEstimate);
  const netBRL = num(quote.totalRateEstimateInBookingCurrency) || netLocal;
  if (netBRL <= 0) return { error: 'Cotação XRS sem valor' };

  const gross = (amountInCents || 0) / 100 + counterChargesBRL(booking);
  if (gross <= 0) return { error: 'Reserva sem valor cobrado' };

  const markupBRL = gross - netBRL;
  const pct = (markupBRL / netBRL) * 100;
  // Fora desta faixa o XRS provavelmente inclui itens (proteções/extras) que não são tarifa do carro
  if (pct < -0.5 || pct > 80) return { error: `Resultado implausível (${pct.toFixed(1)}%) — conferir manualmente` };

  const mk = pct < 0.5 ? 0 : markupBRL;
  return {
    netBRL: round2(netBRL),
    netLocal: netLocal > 0 ? round2(netLocal) : null,
    netCurrency: quote.currency ? String(quote.currency).toUpperCase() : null,
    markupPercent: mk > 0 ? round2(pct) : 0,
    markupBRL: round2(mk),
    capturedAt: new Date().toISOString(),
    source: 'XRS_BACKFILL',
  };
}

/**
 * Snapshot a partir do NET OFICIAL informado pela Europcar (extrato/fatura Greenway ou Click4), em BRL.
 * Mesma conta do reconsultado: markup = (valor cobrado online + sobretaxa paga no balcão) − NET.
 * Não recusa valores (é o número oficial), mas devolve avisos para conferência antes de gravar.
 */
export function buildManualSnapshot(
  customerData: any,
  amountInCents: number | null | undefined,
  netBRLInput: number
): { snapshot: PricingSnapshot; grossBRL: number; warnings: string[] } | { error: string } {
  const cd = customerData || {};
  const booking = cd.booking || {};
  const netBRL = round2(netBRLInput);
  if (!(netBRL > 0)) return { error: 'NET inválido' };

  const gross = round2((amountInCents || 0) / 100 + counterChargesBRL(booking));
  if (gross <= 0) return { error: 'Reserva sem valor cobrado' };

  const warnings: string[] = [];
  if (!isEtoContract(booking.contractID)) warnings.push('Tarifa POA (sem markup contratado)');
  const diff = gross - netBRL;
  if (diff < 0) warnings.push(`NET maior que o valor cobrado (R$ ${(-diff).toFixed(2)}) — markup fica 0`);
  const pct = (diff / netBRL) * 100;
  if (pct > 80) warnings.push(`Markup muito alto (${pct.toFixed(1)}%) — conferir se o NET é o total da reserva`);

  const mk = Math.max(0, diff);
  return {
    grossBRL: gross,
    warnings,
    snapshot: {
      netBRL,
      netLocal: null,
      netCurrency: 'BRL',
      markupPercent: mk > 0 ? round2((mk / netBRL) * 100) : 0,
      markupBRL: round2(mk),
      capturedAt: new Date().toISOString(),
      source: 'EUROPCAR_EXTRATO',
    },
  };
}

/**
 * Snapshot calculando o NET retroativamente a partir da margem nominal (ex.: 25%):
 * NET = gross / (1 + marginPercent / 100)
 * Markup = gross - NET
 */
export function buildNominalMarginSnapshot(
  customerData: any,
  amountInCents: number | null | undefined,
  marginPercentInput?: number
): { snapshot: PricingSnapshot; grossBRL: number } | { error: string } {
  const cd = customerData || {};
  const booking = cd.booking || {};
  const gross = round2((amountInCents || 0) / 100 + counterChargesBRL(booking));
  if (gross <= 0) return { error: 'Reserva sem valor cobrado' };

  const margin = marginPercentInput && marginPercentInput > 0 ? marginPercentInput : 25;
  const netBRL = round2(gross / (1 + (margin / 100)));
  const markupBRL = round2(gross - netBRL);

  return {
    grossBRL: gross,
    snapshot: {
      netBRL,
      netLocal: null,
      netCurrency: 'BRL',
      markupPercent: round2(margin),
      markupBRL,
      capturedAt: new Date().toISOString(),
      source: 'NOMINAL_FALLBACK',
    },
  };
}

