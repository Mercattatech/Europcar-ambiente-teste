/**
 * reservationEmailVars
 *
 * Fonte ÚNICA das variáveis dos e-mails de reserva (RESERVA_SUCESSO,
 * RESERVA_SOB_SOLICITACAO, RESERVA_CONFIRMADA...).
 *
 * Antes, cada rota (cartão, PIX, cron sync-pix, sync-on-request, sync-greenway,
 * reenvio) montava as listas de proteções/acessórios do seu jeito — e vários
 * fluxos pré-pagos enviavam LISTA_PROTECOES/LISTA_EXTRAS vazias ou nem enviavam
 * (o template então exibia o texto cru "{{LISTA_PROTECOES}}").
 *
 * Aqui os dados são lidos de todas as origens onde o checkout os grava:
 *   - customerData.xrsInsurances / customerData.xrsEquipment   (topo)
 *   - customerData.booking.xrsInsurances / .xrsEquipment       (dentro do booking)
 *   - customerData.booking.extras                              (mapa código → qtd)
 *   - customerData.booking.quoteInsurances                     (nomes/preços do getQuote)
 */
import { buildEmailCurrencyVars } from '@/lib/receiptLocales';
import { calculateRentalDays } from '@/lib/europcar/rentalDuration';
import { INSURANCE_NAMES_PT, type XrsSnapshot } from '@/lib/email/xrsReservationSnapshot';
import { buildReservationDetailVars, calcCounterBRL } from '@/lib/email/reservationDetailVars';

// Mesmos códigos de proteção usados em bookXRS.ts / reservas/route.ts
export const INSURANCE_CODES = [
  'TPL', 'LDW', 'CDW', 'THW', 'SCDW', 'SPCDW', 'STHW', 'SPTHW', 'MEDIUM', 'PREMIUM',
  'PREMPRE', 'PREMUP', 'RSA', 'APP', 'PAI', 'PEP', 'SLDW', 'WWI', 'SPAI', 'INTERIOR', 'PREMPLUS',
];

export interface ExtraLine {
  code: string;
  name: string;
  qty: number;
  priceBRL: number;
}

export interface EquipLine {
  code: string;
  name: string;
  icon?: string;
  qty: number;
  priceBRL: number;
  totalBRL: number;
}

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? 0 : n;
};

const fmtBRL = (v: number) => v.toFixed(2).replace('.', ',');

/**
 * Consolida proteções (franquias/coberturas) e acessórios contratados, sem duplicar,
 * olhando todas as origens possíveis dentro do customerData da reserva.
 */
export function resolveReservationExtras(
  customerData: any,
  overrides?: { xrsInsurances?: any[]; xrsEquipment?: any[] },
): { extras: ExtraLine[]; equipment: EquipLine[] } {
  const cd = customerData || {};
  const booking = cd.booking || {};

  const insMap = new Map<string, ExtraLine>();
  const eqMap = new Map<string, EquipLine>();

  const addIns = (ins: any, qty?: number) => {
    const code: string | undefined = typeof ins === 'string' ? ins : ins?.code;
    if (!code) return;
    const obj = typeof ins === 'object' && ins ? ins : {};
    const existing = insMap.get(code);
    if (existing) {
      if ((!existing.name || existing.name === code) && obj.name) existing.name = obj.name;
      if (!existing.priceBRL && num(obj.priceBRL) > 0) existing.priceBRL = num(obj.priceBRL);
      if (qty && qty > existing.qty) existing.qty = qty;
      return;
    }
    insMap.set(code, { code, name: obj.name || code, qty: qty && qty > 0 ? qty : 1, priceBRL: num(obj.priceBRL) });
  };

  const addEq = (eq: any, qty?: number) => {
    const code: string | undefined = eq?.code;
    if (!code) return;
    const q = Math.max(num(eq.qty), qty || 0) || 1;
    if (q <= 0) return;
    const existing = eqMap.get(code);
    if (existing) {
      if ((!existing.name || existing.name === code) && eq.name) existing.name = eq.name;
      if (!existing.priceBRL && num(eq.priceBRL) > 0) existing.priceBRL = num(eq.priceBRL);
      if (!existing.totalBRL && num(eq.totalBRL) > 0) existing.totalBRL = num(eq.totalBRL);
      if (q > existing.qty) existing.qty = q;
      return;
    }
    eqMap.set(code, {
      code,
      name: eq.name || code,
      icon: eq.icon,
      qty: q,
      priceBRL: num(eq.priceBRL),
      totalBRL: num(eq.totalBRL),
    });
  };

  // 1) Listas explícitas (parâmetro) → topo do customerData → dentro do booking
  for (const list of [overrides?.xrsInsurances, cd.xrsInsurances, booking.xrsInsurances]) {
    if (Array.isArray(list)) list.forEach((i) => addIns(i));
  }
  for (const list of [overrides?.xrsEquipment, cd.xrsEquipment, booking.xrsEquipment]) {
    if (Array.isArray(list)) list.filter((e: any) => num(e?.qty) > 0 || e?.qty === undefined).forEach((e) => addEq(e));
  }

  // 2) Mapa booking.extras (código → qtd): completa o que não veio nas listas acima
  const extrasMap: Record<string, any> = booking.extras && typeof booking.extras === 'object' ? booking.extras : {};
  const quoteIns: any[] = Array.isArray(booking.quoteInsurances) ? booking.quoteInsurances : [];
  for (const [code, rawQty] of Object.entries(extrasMap)) {
    const qty = num(rawQty);
    if (qty <= 0) continue;
    if (insMap.has(code)) { addIns(code, qty); continue; }
    if (eqMap.has(code)) { addEq({ code }, qty); continue; }

    if (INSURANCE_CODES.includes(code)) {
      const qi = quoteIns.find((i: any) => i?.code === code);
      addIns({
        code,
        name: qi?.descr || code,
        priceBRL: num(qi?.rentalPriceInBookingCurrencyAI),
      }, qty);
    } else {
      addEq({ code, qty });
    }
  }

  // Nome amigável (PT) quando só temos o código
  const extras = [...insMap.values()].map((e) =>
    (!e.name || e.name === e.code) && INSURANCE_NAMES_PT[e.code] ? { ...e, name: INSURANCE_NAMES_PT[e.code] } : e,
  );

  return { extras, equipment: [...eqMap.values()] };
}

/** Converte as listas em HTML simples (<br/>) para os placeholders do template. */
export function buildExtrasListVars(
  customerData: any,
  overrides?: { xrsInsurances?: any[]; xrsEquipment?: any[] },
): { LISTA_PROTECOES: string; LISTA_EXTRAS: string; extras: ExtraLine[]; equipment: EquipLine[] } {
  const { extras, equipment } = resolveReservationExtras(customerData, overrides);

  const LISTA_PROTECOES = extras.length > 0
    ? extras
        .map((ex) => `• 🛡️ ${ex.name || ex.code}${ex.qty > 1 ? ` ×${ex.qty}` : ''}${ex.priceBRL > 0 ? ` — R$ ${fmtBRL(ex.priceBRL)}` : ''}`)
        .join('<br/>')
    : 'Nenhuma proteção adicional selecionada';

  const LISTA_EXTRAS = equipment.length > 0
    ? equipment
        .map((eq) => `• ${eq.icon || '📦'} ${eq.name || eq.code} ×${eq.qty || 1}${eq.priceBRL > 0 ? ` — R$ ${fmtBRL(eq.priceBRL)} /dia` : ''}`)
        .join('<br/>')
    : 'Nenhum acessório selecionado';

  return { LISTA_PROTECOES, LISTA_EXTRAS, extras, equipment };
}

// ── Datas/horários ─────────────────────────────────────────────
const fmtDate = (d?: string) => (d && d.length >= 8 && /^\d{8}/.test(d) ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : d || '');

const fmtTime = (d?: string) => {
  if (!d) return '';
  const tIdx = d.indexOf('T');
  if (tIdx >= 0) {
    const t = d.slice(tIdx + 1);
    return t.length >= 4 ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : t;
  }
  const digits = d.replace(/\D/g, '');
  if (/^\d{4}$/.test(digits) && digits === d) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  return '';
};

const PAYMENT_LABEL: Record<string, string> = {
  BALCAO: 'Pagamento no Balcão',
  PIX: 'PIX',
  CREDIT: 'Cartão de Crédito',
  VOUCHER: 'Voucher ETO (Faturado)',
};

/**
 * Valor na moeda de destino (ex.: € 421,50) + valor pago em Real.
 *
 * Moeda local: car.currency → moeda da cotação no XRS → moeda da estação de retirada.
 * (NÃO usar bookingCurrency: é a moeda de PAGAMENTO — BRL — e fazia o e-mail sair só em R$.)
 * Câmbio: car.exchangeRate → câmbio da cotação lida no XRS.
 */
export function buildDestinationCurrencyVars(
  totalBRL: number,
  booking: any,
  car: any,
  xrs?: XrsSnapshot | null,
) {
  const isForeign = (c?: string | null) => !!c && c.length === 3 && c.toUpperCase() !== 'BRL';
  const hint = [car?.currency, xrs?.quote?.currency].find(isForeign) || null;
  const rate = num(car?.exchangeRate) || num(xrs?.quote?.exchangeRate);
  const cv = buildEmailCurrencyVars(totalBRL, booking?.pickupStation, rate, hint ? hint.toUpperCase() : null);
  return { ...cv, MOEDA_ESTRANGEIRA: cv.MOEDA !== 'BRL' ? '1' : '' };
}

/**
 * Monta o dicionário COMPLETO de variáveis dos templates de reserva a partir do
 * customerData salvo na LocalReservation (ou do objeto equivalente em memória).
 *
 * `xrs` (opcional): snapshot do XML da reserva no XRS (fetchXrsSnapshot). Quando informado,
 * proteções/acessórios do XRS são somados aos dados locais e a cotação do XRS completa
 * moeda/câmbio se o car salvo localmente não os tiver.
 * `preferPaidAmount`: usa amountInCents (valor realmente pago) como total em R$.
 */
export function buildReservationEmailVars(params: {
  customerData: any;
  resNumber: string;
  amountInCents?: number | null;
  paymentMethod?: string;
  extraVars?: Record<string, string>;
  xrs?: XrsSnapshot | null;
  preferPaidAmount?: boolean;
}) {
  const cd = params.customerData || {};
  const booking = cd.booking || {};
  const car = booking.car || {};
  const paymentMethod = params.paymentMethod || cd.paymentMethod || 'CREDIT';

  const lists = buildExtrasListVars(cd, params.xrs ? { xrsInsurances: params.xrs.insurances, xrsEquipment: params.xrs.equipment } : undefined);

  // Total completo = veículo + proteções + acessórios (fallback: valor cobrado)
  let days = 1;
  try {
    days = calculateRentalDays({
      pickupDate: booking.pickupDate,
      pickupTime: booking.pickupTime || '1000',
      returnDate: booking.returnDate,
      returnTime: booking.returnTime || '1000',
      station: booking.pickupStation,
      country: booking.stationCountry || booking.driverCountry || cd.pais,
      apiDuration: booking.duration || car.duration,
    });
  } catch { /* mantém 1 */ }

  const vehicleBRLNet = num(car.totalRateEstimateInBookingCurrency || car.totalRateEstimate);
  const insBRL = lists.extras.reduce((s, e) => s + e.priceBRL, 0);
  const equipBRL = lists.equipment.reduce((s, e) => s + (e.totalBRL > 0 ? e.totalBRL : e.priceBRL * days) * (e.qty || 1), 0);
  const paidBRL = (params.amountInCents || 0) / 100;
  const rateForCounter = num(car?.exchangeRate) || num(params.xrs?.quote?.exchangeRate);

  // ⚠️ MARKUP: o car salvo na reserva é REGRAVADO com a cotação do XRS (api/reservas, sync-greenway),
  // que é a tarifa NET — o markup (eto_margin_percent) é aplicado só na tela de veículos e fica apenas
  // no valor efetivamente cobrado (amountInCents). Em reservas pré-pagas o valor cobrado é a fonte da
  // verdade: total completo = cobrado online + o que é pago no balcão (ex.: sobretaxa de aeroporto).
  const prepaidWithPaid = paymentMethod !== 'BALCAO' && paidBRL > 0;
  const fullPrepaidBRL = prepaidWithPaid
    ? paidBRL + calcCounterBRL(booking, car, rateForCounter)
    : 0;
  const vehicleBRL = prepaidWithPaid
    ? Math.max(0, fullPrepaidBRL - insBRL - equipBRL)
    : vehicleBRLNet;

  const totalBRL = params.preferPaidAmount && paidBRL > 0
    ? paidBRL
    : prepaidWithPaid
      ? fullPrepaidBRL
      : ((vehicleBRL + insBRL + equipBRL) || paidBRL);

  const cv = buildDestinationCurrencyVars(totalBRL, booking, car, params.xrs);

  // Detalhamento pedido pelos clientes (diárias, km, incluídos, franquia, câmbio, online × balcão).
  // Nunca pode impedir o envio do e-mail: em caso de erro, as variáveis ficam vazias.
  let detail: Record<string, string> = {};
  try {
    detail = buildReservationDetailVars({
      booking,
      car,
      days,
      currency: cv.MOEDA,
      rate: rateForCounter,
      extras: lists.extras,
      vehicleBRL,
      insBRL,
      equipBRL,
      paidBRL,
      paymentMethod,
      xrs: params.xrs,
      fmtPair: (brl: number) => buildDestinationCurrencyVars(brl, booking, car, params.xrs).VALOR_TOTAL,
    });
  } catch (err: any) {
    console.warn('[reservationEmailVars] Falha ao montar detalhamento:', err?.message);
  }

  const vars: Record<string, string> = {
    NOME: cd.nome || cd.firstName || '',
    SOBRENOME: cd.sobrenome || cd.lastName || '',
    EMAIL: cd.email || '',
    TELEFONE: cd.telefone || '',
    CPF: cd.cpf || '',
    NUMERO_RESERVA: params.resNumber || '',
    VALOR_TOTAL: cv.VALOR_TOTAL,
    VALOR_LOCAL: cv.VALOR_LOCAL,
    VALOR_BRL: cv.VALOR_BRL,
    MOEDA: cv.MOEDA,
    // '1' só quando a moeda NÃO é BRL — usado em {{#MOEDA_ESTRANGEIRA}}...{{/MOEDA_ESTRANGEIRA}}
    MOEDA_ESTRANGEIRA: cv.MOEDA_ESTRANGEIRA,
    FORMA_PAGAMENTO: PAYMENT_LABEL[paymentMethod] || paymentMethod || '',
    CARRO: car.carCategoryName || car.carCategorySample || car.name || '',
    CATEGORIA_CARRO: car.acrissCode || car.carCategoryCode || booking.carCategory || '',
    DATA_RETIRADA: fmtDate(booking.pickupDate),
    HORARIO_RETIRADA: fmtTime(booking.pickupDate) || fmtTime(booking.pickupTime),
    LOCAL_RETIRADA: booking.pickupStation || '',
    DATA_DEVOLUCAO: fmtDate(booking.returnDate),
    HORARIO_DEVOLUCAO: fmtTime(booking.returnDate) || fmtTime(booking.returnTime),
    LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
    LISTA_PROTECOES: lists.LISTA_PROTECOES,
    LISTA_EXTRAS: lists.LISTA_EXTRAS,
    ...detail,
    ...(params.extraVars || {}),
  };

  return { vars, lists, totalBRL };
}
