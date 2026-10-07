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
  source: 'XRS_QUOTE' | 'XRS_BACKFILL' | 'ESTIMADO';
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
 * (valor cobrado online + sobretaxa paga no balcão = NET × (1 + margem). Se o car salvo tiver a cotação NET
 * do XRS, o markup é a diferença; senão o NET é derivado da margem configurada. Só contratos ETO).
 */
export function resolvePricingSnapshot(
  customerData: any,
  amountInCents: number | null | undefined,
  opts?: { configuredMarkupPercent?: number }
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
      source: s.source === 'XRS_BACKFILL' ? 'XRS_BACKFILL' : 'XRS_QUOTE',
    };
  }

  const booking = cd.booking || {};
  const car = booking.car || {};
  const carLocal = num(car.totalRateEstimate);
  const carBRL = num(car.totalRateEstimateInBookingCurrency) || carLocal;
  const paid = (amountInCents || 0) / 100;
  const eto = isEtoContract(booking.contractID);

  // O checkout cobra online (total com markup − sobretaxa paga no balcão). Para comparar com o NET
  // (total TRE do XRS) é preciso somar de volta o que é pago no balcão.
  const grossOnline = paid + counterChargesBRL(booking);

  let netBRL = carBRL;
  let netLocal = carLocal;
  let markupBRL = 0;

  if (eto && grossOnline > 0) {
    const carLooksLikeNet = carBRL > 0 && Math.abs(carBRL - grossOnline) / grossOnline > 0.01;
    if (carLooksLikeNet) {
      // Car regravado com a cotação do XRS = NET real
      markupBRL = Math.max(0, grossOnline - carBRL);
    } else {
      // Car guardado já com markup (ou ausente): deriva o NET do valor cobrado e da margem configurada
      const pct = Math.max(0, opts?.configuredMarkupPercent || 0);
      netBRL = grossOnline / (1 + pct / 100);
      netLocal = carLocal > 0 && carBRL > 0 ? carLocal * (netBRL / carBRL) : 0;
      markupBRL = grossOnline - netBRL;
    }
    if (markupBRL < netBRL * 0.005) markupBRL = 0; // arredondamento/câmbio não é markup
  }
  if (netBRL <= 0) return null;

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
