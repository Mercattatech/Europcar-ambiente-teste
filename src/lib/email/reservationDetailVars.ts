/**
 * reservationDetailVars
 *
 * Variáveis do detalhamento financeiro/contratual dos e-mails de reserva — as informações que
 * o cliente costuma pedir por escrito antes de pagar (diárias, quilometragem, o que está
 * incluído, proteções e franquia, câmbio, quanto vai online × balcão, cobranças no balcão).
 *
 * Fontes: customerData.booking (quoteInsurances do getQuote, car) e o XML da reserva no XRS.
 *
 * ⚠️ O valor da CAUÇÃO NÃO é informado pelo XRS — por isso o e-mail traz só o texto explicativo
 *    (ver template), nunca um valor.
 */
import type { ExtraLine } from '@/lib/email/reservationEmailVars';
import type { XrsSnapshot } from '@/lib/email/xrsReservationSnapshot';

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? 0 : n;
};

const AIRPORT_CODES = ['APF', 'APT', 'AIRPORTFEE', 'APS', 'ASF', 'APF2', 'APTF', 'STF'];

/** Cobrança paga no balcão (mesma regra do checkout: paidBy counter/business ou código de aeroporto). */
const isCounterCharge = (i: any): boolean => {
  if (i?.paidBy === 'counter' || i?.paidBy === 'business') return true;
  return !i?.paidBy && AIRPORT_CODES.includes(String(i?.code || '').toUpperCase());
};

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

/** Valor em R$ de uma cobrança (priceInBookingCurrency → rentalPrice...AI → preço local × câmbio). */
const chargeBRL = (c: any, rate: number): number => {
  const brl = num(c?.priceInBookingCurrency) > 0 ? num(c.priceInBookingCurrency) : num(c?.rentalPriceInBookingCurrencyAI);
  if (brl > 0) return brl;
  const local = num(c?.price);
  return local > 0 ? local * (rate > 0 ? rate : 1) : 0;
};

/**
 * Total (R$) das cobranças pagas no balcão (ex.: sobretaxa de aeroporto) da reserva.
 * Fallback: amountToPayOnArrival da cotação.
 */
export function calcCounterBRL(booking: any, car: any, rate: number): number {
  const quoteIns: any[] = Array.isArray(booking?.quoteInsurances) ? booking.quoteInsurances : [];
  const sum = quoteIns.filter(isCounterCharge).reduce((s, c) => s + chargeBRL(c, rate), 0);
  return sum > 0 ? sum : num(car?.amountToPayOnArrivalInBookingCurrency);
}

const fmtLocal = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

export interface DetailVarsParams {
  booking: any;
  car: any;
  days: number;
  /** Moeda de destino (ex.: EUR); 'BRL' quando a reserva é em reais */
  currency: string;
  /** 1 unidade da moeda local = X BRL */
  rate: number;
  extras: ExtraLine[];
  vehicleBRL: number;
  insBRL: number;
  equipBRL: number;
  /** Valor realmente cobrado online (R$), quando conhecido */
  paidBRL: number;
  paymentMethod: string;
  xrs?: XrsSnapshot | null;
  /** Formata um valor em R$ como "€ 12,80 (≈ R$ 77,29)" (ou só "R$ ..." em reservas em reais) */
  fmtPair: (brl: number) => string;
}

export function buildReservationDetailVars(p: DetailVarsParams): Record<string, string> {
  const { booking, car, days, currency, rate, extras, xrs } = p;
  const foreign = currency !== 'BRL' && rate > 0;
  const quoteIns: any[] = Array.isArray(booking?.quoteInsurances) ? booking.quoteInsurances : [];

  /** "€ 570,00 (≈ R$ 3.441,58)" a partir de valores reais do XRS (local + R$). */
  const fmtBoth = (local: number, brl: number): string => {
    if (!foreign) return fmtBRL(brl || local);
    const loc = local > 0 ? local : brl / rate;
    const reais = brl > 0 ? brl : local * rate;
    return `${fmtLocal(loc, currency)} (≈ ${fmtBRL(reais)})`;
  };

  // ── Diárias ────────────────────────────────────────────────
  const d = Math.max(1, Math.round(p.days || 1));

  // ── Quilometragem ──────────────────────────────────────────
  let QUILOMETRAGEM = '';
  if (car?.mileageType === 'Livre') {
    QUILOMETRAGEM = 'Ilimitada';
  } else if (car?.mileageLimit) {
    const unit = car.mileageUnit || 'km';
    const per = car.mileageKmType === 'R' ? 'no período da locação' : 'por dia';
    QUILOMETRAGEM = `${car.mileageLimit} ${unit} ${per}` + (num(car.extraMileageCost) > 0 ? ' (km excedente cobrado conforme contrato)' : '');
  }

  // ── Tarifa ─────────────────────────────────────────────────
  let TARIFA = '';
  if (p.paymentMethod === 'BALCAO') TARIFA = 'Pagar no balcão';
  else if (booking?.tariffType === 'ETO') TARIFA = 'Pagar agora — cancelamento grátis';

  // ── Cobranças pagas no balcão (ex.: sobretaxa de aeroporto) ─
  const counter = quoteIns.filter(isCounterCharge);
  const counterLines: string[] = [];
  for (const c of counter) {
    const brl = num(c.priceInBookingCurrency) > 0 ? num(c.priceInBookingCurrency) : num(c.rentalPriceInBookingCurrencyAI);
    const local = num(c.price);
    if (brl <= 0 && local <= 0) continue;
    counterLines.push(`• ${c.descr || c.code} — ${fmtBoth(local, brl)}`);
  }
  const counterBRL = calcCounterBRL(booking, car, rate);
  const isPrepaid = p.paymentMethod !== 'BALCAO';
  const showSplit = isPrepaid && counterBRL > 0;

  // ── O que está incluído ────────────────────────────────────
  const selectedCodes = new Set(extras.map((e) => e.code));
  const seenInc = new Set<string>();
  const includedLines: string[] = [];
  const pushInc = (txt: string) => {
    const k = txt.toLowerCase();
    if (!txt || seenInc.has(k)) return;
    seenInc.add(k);
    includedLines.push(`• ${txt}`);
  };
  if (QUILOMETRAGEM) pushInc(`Quilometragem: ${QUILOMETRAGEM.toLowerCase()}`);
  for (const i of quoteIns) {
    if (isCounterCharge(i)) continue;
    const isIncluded = i.type === 'M' || i.type === 'I' || i.includedInTotal === 'Y';
    if (!isIncluded || selectedCodes.has(String(i.code || ''))) continue;
    // Linhas de taxa com valor 0 e sem nome útil não agregam
    pushInc(String(i.descr || i.code || '').trim());
  }
  if (xrs?.vatPercent && !includedLines.some((l) => /iva|imposto|vat/i.test(l))) {
    pushInc(`IVA ${xrs.vatPercent}%`);
  }
  if (includedLines.length > 0) pushInc('Taxas e impostos aplicáveis ao aluguel');

  // ── Franquia das proteções contratadas ─────────────────────
  const franquiaLines: string[] = [];
  for (const ex of extras) {
    const q = quoteIns.find((i) => String(i.code || '').toUpperCase() === ex.code.toUpperCase());
    const x = xrs?.excess?.[ex.code.toUpperCase()];
    if (q?.type === 'I' && !x) continue; // incluída na tarifa: franquia depende da cobertura-base
    const local = x ? x.local : num(q?.excessWithPOM);
    const brl = x ? x.brl : num(q?.bkExcessWithPOM);
    if (!q && !x) continue;
    franquiaLines.push(
      local === 0 && brl === 0
        ? `• ${ex.name || ex.code}: <strong>franquia zero</strong>`
        : `• ${ex.name || ex.code}: franquia de <strong>${fmtBoth(local, brl)}</strong>`,
    );
  }
  const ded = num(car?.deductibleAmount);
  if (ded > 0) {
    const cur = String(car?.deductibleCurrency || '').toUpperCase();
    franquiaLines.push(
      `• Cobertura básica incluída na tarifa: franquia de <strong>${cur && cur !== 'BRL' ? fmtLocal(ded, cur) : fmtBRL(ded)}</strong>`,
    );
  }

  const totalFull = p.vehicleBRL + p.insBRL + p.equipBRL;

  return {
    QTD_DIARIAS: String(d),
    TEXTO_DIARIAS: `${d} diária${d > 1 ? 's' : ''}`,
    QUILOMETRAGEM,
    TARIFA,
    VALOR_VEICULO: p.vehicleBRL > 0 ? p.fmtPair(p.vehicleBRL) : '',
    VALOR_PROTECOES: p.insBRL > 0 ? p.fmtPair(p.insBRL) : '',
    VALOR_ACESSORIOS: p.equipBRL > 0 ? p.fmtPair(p.equipBRL) : '',
    TOTAL_RESERVA: totalFull > 0 ? p.fmtPair(totalFull) : '',
    CAMBIO: foreign ? `1 ${currency} = R$ ${rate.toFixed(4).replace('.', ',')}` : '',
    VALOR_PAGO_ONLINE: showSplit && p.paidBRL > 0 ? p.fmtPair(p.paidBRL) : '',
    VALOR_BALCAO: showSplit ? p.fmtPair(counterBRL) : '',
    LISTA_BALCAO: showSplit ? counterLines.join('<br/>') : '',
    LISTA_INCLUIDOS: includedLines.join('<br/>'),
    LISTA_FRANQUIA: franquiaLines.length > 0
      ? franquiaLines.join('<br/>')
      : 'O valor da franquia aplicável consta no Contrato de Locação emitido pela estação de retirada.',
  };
}
