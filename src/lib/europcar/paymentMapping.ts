// Monta os atributos de pagamento (prepaidMode/prepaidPercentage/prepaidAmount)
// e o nó <meanOfPayment> do bookReservation XRS a partir do método de
// pagamento escolhido no checkout. Centraliza a regra para não duplicar entre
// reservas/route.ts (fluxo síncrono: CREDIT/BALCAO/VOUCHER) e bookXRS.ts
// (fluxo assíncrono: PIX confirmado).

export const CID_TO_BA: Record<string, string> = {
  '56935466': '73675595',  // ETO Líquido (Excesso)
  '56935495': '73804373',  // ETO Internacional (Excesso Zero)
};

export interface VoucherContext {
  type: string;           // 'ETO' | 'EXO' | 'EOTTO' | 'ETV' | ...
  id?: string;
  businessAccount?: string;
  iataNumber?: string;
}

export interface CreditCardGuaranteeContext {
  number: string;         // PAN — nunca logar em texto claro
  holderName: string;
  validity: string;       // MM/AAAA
  cardIssuer: string;     // sigla de 2 letras (VI/CA/AX/EC/DC...)
}

export interface PaymentAttrsContext {
  method: 'CREDIT' | 'PIX' | 'BALCAO' | 'VOUCHER';
  /** true quando a Cielo já capturou o pagamento (cartão cobrado agora, ou PIX confirmado) */
  captured: boolean;
  amountBRL?: number;
  creditCardGuarantee?: CreditCardGuaranteeContext;
  voucherData?: VoucherContext;
  contractID?: string;
  carCategory?: string;
  pickupDate?: string;    // YYYYMMDD
  returnDate?: string;    // YYYYMMDD
  pickupTime?: string;    // HHMM
  returnTime?: string;    // HHMM
  station?: string;
  country?: string;
  duration?: number;
  /** MerchantOrderId da cobrança Cielo — usado como voucherID do nó VCH/PP quando captured=true */
  merchantOrderId?: string;
  /** Número IATA da agência para envio ao GreenWay (ex: reservas POA / comissionamento) */
  iataNumber?: string;
}

/** Contratos ETO (Pagar Agora): exigem pagamento online e geram VCH no GreenWay. */
export const ETO_CIDS = ['56935466', '56935495'];

/**
 * Valida a coerência entre tarifa/contrato e forma de pagamento.
 * Retorna a mensagem de erro ou null quando está tudo certo.
 *
 * Balcão (pagamento no destino) com contrato/tarifa ETO resultaria em uma reserva
 * tratada como voucher no GreenWay — nunca deve chegar ao XRS.
 */
export function validateContractPaymentConsistency(params: {
  method?: string;
  contractID?: string;
  tariffType?: string;
}): string | null {
  const { method, contractID, tariffType } = params;
  const isEtoTariff = (!!contractID && ETO_CIDS.includes(contractID)) || tariffType === 'ETO';
  if (method === 'BALCAO' && isEtoTariff) {
    return 'Tarifa "Pagar Agora" (ETO) não permite pagamento no balcão. Volte, escolha a tarifa "Pagar no balcão" e refaça a reserva.';
  }
  return null;
}

/** Escapa caracteres especiais XML para atributos ou nós */
function escapeXml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const BRAZIL_PREFIXES = ['BR', 'GRU', 'CGH', 'GIG', 'SDU', 'BSB', 'CNF', 'POA', 'SSA', 'REC', 'FOR', 'CWB', 'FLN', 'VCP', 'NAT', 'MCZ', 'NVT', 'VIX', 'GYN', 'CGB', 'MAO', 'BEL', 'IGU', 'AJU', 'JPA', 'SLZ', 'THE'];

function isBrazil(station?: string, country?: string): boolean {
  if (country) {
    const c = country.trim().toUpperCase();
    if (c === 'BR' || c === 'BRA' || c === 'BRASIL' || c === 'BRAZIL') return true;
  }
  if (station) {
    const s = station.trim().toUpperCase();
    if (BRAZIL_PREFIXES.some(prefix => s.startsWith(prefix))) return true;
  }
  return false;
}

function parseDateTimeSafe(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr || dateStr.length < 8) return null;
  let year = 0, month = 0, day = 0;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2].slice(0, 2), 10);
    }
  } else {
    year = parseInt(dateStr.slice(0, 4), 10);
    month = parseInt(dateStr.slice(4, 6), 10) - 1;
    day = parseInt(dateStr.slice(6, 8), 10);
  }
  if (isNaN(year) || isNaN(month) || isNaN(day) || year === 0) return null;
  const cleanTime = (timeStr || '1000').replace(/\D/g, '').padStart(4, '0');
  const hour = Math.min(23, Math.max(0, parseInt(cleanTime.slice(0, 2), 10) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(cleanTime.slice(2, 4), 10) || 0));
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
}

function voucherDurationDays(
  pickupDate?: string,
  returnDate?: string,
  pickupTime?: string,
  returnTime?: string,
  apiDuration?: number,
  station?: string,
  country?: string
): number {
  if (typeof apiDuration === 'number' && apiDuration > 0) return apiDuration;
  const dt1 = parseDateTimeSafe(pickupDate, pickupTime);
  const dt2 = parseDateTimeSafe(returnDate, returnTime);
  if (!dt1 || !dt2) return 0;
  const diffMs = dt2.getTime() - dt1.getTime();
  if (diffMs <= 0) return 0;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const fullDays = Math.floor(diffMs / DAY_MS);
  const remainingMs = diffMs % DAY_MS;
  const toleranceMinutes = isBrazil(station, country) ? 59 : 29;
  const toleranceMs = toleranceMinutes * 60 * 1000;
  const extraDay = remainingMs > toleranceMs ? 1 : 0;
  return Math.max(1, fullDays + extraDay);
}

/** Constrói o fragmento <meanOfPayment typeCode="VCH" .../> para o bookReservation inicial.
 *  EXO não entra aqui: o voucher EXO é registrado depois via createVoucher (ver buildCreateVoucherXml). */
function buildVoucherMeanOfPaymentXml(
  voucherData: VoucherContext,
  contractID?: string,
  carCategory?: string,
  pickupDate?: string,
  returnDate?: string,
  pickupTime?: string,
  returnTime?: string,
  apiDuration?: number,
  station?: string,
  country?: string,
): string {
  if (!voucherData || voucherData.type === 'EXO') return '';
  const ba = (contractID && CID_TO_BA[contractID]) || voucherData.businessAccount || '';
  const duration = voucherDurationDays(pickupDate, returnDate, pickupTime, returnTime, apiDuration, station, country);
  // Antonio/Europcar: voucherID must be numeric, max 8 digits
  const numericVoucherID = (voucherData.id && /^\d{1,8}$/.test(voucherData.id))
    ? voucherData.id
    : Date.now().toString().slice(-8);

  return `\n        <meanOfPayment typeCode="VCH" voucherType="${escapeXml(voucherData.type)}" voucherID="${escapeXml(numericVoucherID)}" businessAccount="${escapeXml(ba)}" voucherCarCategory="${escapeXml(carCategory || '')}" voucherRentalDuration="${escapeXml(duration)}"/>`;
}

export interface PaymentAttrsResult {
  /** Ex: ' prepaidMode="NP"' ou ' prepaidMode="PP" prepaidPercentage="100.00" prepaidAmountInBookingCurrency="123.45"' — vazio para voucher */
  prepaidAttrs: string;
  /** Fragmento XML do nó <meanOfPayment> (VCH ou CC), ou string vazia */
  meanOfPaymentXml: string;
  /** Atributo IATANumber para o nó <reservation> quando aplicável (POA / agência) */
  iataAttr: string;
}

export function buildReservationPaymentAttrs(ctx: PaymentAttrsContext): PaymentAttrsResult {
  const isETO = ctx.contractID === '56935466' || ctx.contractID === '56935495' || (ctx.voucherData && ctx.voucherData.type === 'ETO');
  const iataAttr = (!isETO && ctx.iataNumber) ? ` IATANumber="${escapeXml(ctx.iataNumber)}"` : '';

  // Voucher: o próprio nó VCH substitui o prepaidMode (exceto EXO, que segue o
  // fluxo padrão prepaidMode="NP" + createVoucher em uma segunda chamada).
  if (ctx.method === 'VOUCHER' && ctx.voucherData) {
    const meanOfPaymentXml = buildVoucherMeanOfPaymentXml(
      ctx.voucherData,
      ctx.contractID,
      ctx.carCategory,
      ctx.pickupDate,
      ctx.returnDate,
      ctx.pickupTime,
      ctx.returnTime,
      ctx.duration,
      ctx.station,
      ctx.country,
    );
    const prepaidAttrs = ctx.voucherData.type === 'EXO' ? ' prepaidMode="NP"' : '';
    return { prepaidAttrs, meanOfPaymentXml, iataAttr };
  }

  // Pago online (PIX confirmado ou Cartão capturado pela Cielo):
  if (ctx.captured) {
    if (isETO) {
      // ETO (corporativo): meanOfPayment VCH vai DIRETO no bookReservationRQ.
      // Confirmado por Antonio/Europcar: createVoucher NÃO é suportado para ETO.
      // O erro mop.invalidVoucherNumber era causado por voucherID com mais de 8 dígitos.
      // voucherID: numérico, máximo 8 dígitos.
      const ba = CID_TO_BA[ctx.contractID!] || '';
      const duration = voucherDurationDays(
        ctx.pickupDate,
        ctx.returnDate,
        ctx.pickupTime,
        ctx.returnTime,
        ctx.duration,
        ctx.station,
        ctx.country,
      );
      const voucherID = (ctx.merchantOrderId || '').replace(/\D/g, '').slice(0, 8)
                        || Date.now().toString().slice(-8);
      const meanOfPaymentXml = `\n        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${escapeXml(voucherID)}" businessAccount="${escapeXml(ba)}" voucherCarCategory="${escapeXml(ctx.carCategory || '')}" voucherRentalDuration="${escapeXml(duration)}"/>`;
      return { prepaidAttrs: '', meanOfPaymentXml, iataAttr };
    } else {
      // POA público: sempre pagamento no destino (prepaidMode="NP")
      return { prepaidAttrs: ' prepaidMode="NP"', meanOfPaymentXml: '', iataAttr };
    }
  }

  // Pagar na retirada: prepaidMode="NP". Se houver cartão de garantia (guarantee,
  // não cobrado agora), inclui o nó CC com cardmask="Y" para não expor o PAN.
  const cc = ctx.creditCardGuarantee;
  const meanOfPaymentXml = cc
    ? `\n        <meanOfPayment typeCode="CC" cardIssuer="${escapeXml(cc.cardIssuer)}" cardNumber="${escapeXml(cc.number)}" cardHolderName="${escapeXml(cc.holderName)}" validade="${escapeXml(cc.validity)}" cardmask="Y"/>`
    : '';
  return { prepaidAttrs: ' prepaidMode="NP"', meanOfPaymentXml, iataAttr };
}

/** Segunda etapa: registra o voucher ETO ou EXO no GreenWay após o resNumber existir.
 *  - ETO: usa businessAccount (BA) para faturamento corporativo
 *  - EXO: usa IATANumber para faturamento via agência
 *
 *  voucherCarCategory e voucherRentalDuration são obrigatórios pelo XRS — sem eles
 *  o createVoucher falha silenciosamente (erro só logado, não aborta a reserva),
 *  deixando a reserva sem split registrado no GW. Confirmado comparando com
 *  buildVoucherMeanOfPaymentXml (fluxo manual, já testado em homologação) e com
 *  a resposta real do GW em scratch/relatorio_homologacao.json, que sempre inclui
 *  esses dois atributos no meanOfPayment retornado. */
export function buildCreateVoucherXml(
  resNumber: string,
  voucherData: VoucherContext,
  voucherAmount: string,
  voucherCurrency: string,
  carCategory?: string,
  pickupDate?: string,
  returnDate?: string,
  pickupTime?: string,
  returnTime?: string,
  apiDuration?: number,
  station?: string,
  country?: string,
): string {
  const isETO = voucherData.type === 'ETO';
  const duration = voucherDurationDays(
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    apiDuration,
    station,
    country,
  );

  // Antonio/Rafael (Europcar): voucherID deve ser numérico, máximo 8 dígitos
  const rawId = voucherData.id || resNumber;
  const numericVoucherID = (rawId && /^\d{1,8}$/.test(rawId.replace(/\D/g, '')))
    ? rawId.replace(/\D/g, '').slice(-8)
    : Date.now().toString().slice(-8);

  const durationAttr = duration > 0 ? ` voucherRentalDuration="${escapeXml(String(duration))}"` : '';
  const carCategoryAttr = carCategory ? ` voucherCarCategory="${escapeXml(carCategory)}"` : '';

  if (isETO) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createVoucher">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}">
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${escapeXml(numericVoucherID)}" businessAccount="${escapeXml(voucherData.businessAccount || '')}" voucherAmount="${escapeXml(voucherAmount)}" voucherCurrency="${escapeXml(voucherCurrency)}"${carCategoryAttr}${durationAttr}/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;
  }

  // EXO (Voucher de Agência / POA): dados completos de meanOfPayment VCH exigidos pelo GreenWay (Rafael/Europcar)
  const iata = voucherData.iataNumber || '02170722';
  return `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createVoucher">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}">
        <meanOfPayment typeCode="VCH" voucherType="EXO" voucherID="${escapeXml(numericVoucherID)}" IATANumber="${escapeXml(iata)}" voucherAmount="${escapeXml(voucherAmount)}" voucherCurrency="${escapeXml(voucherCurrency)}"${carCategoryAttr}${durationAttr}/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;
}

