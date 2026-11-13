/**
 * Testes da regra de pagamento on-line (conta empresarial) × balcão.
 *
 * Rodar:  npm run test:payment
 * (usa o test runner nativo do Node — sem dependências novas)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStringPromise } from 'xml2js';
import {
  computePaymentSplit,
  formatBRL,
  formatMoney,
  formatBRLWithLocal,
  includedExcessText,
  counterNotice,
} from '../src/lib/europcar/paymentSplit.ts';
import {
  DEFAULT_EMAIL_SUMMARY_CONFIG,
  normalizeEmailSummaryConfig,
  filterEmailHtmlByConfig,
} from '../src/lib/email/emailSummaryConfig.ts';
import { computeReservationMetrics } from '../src/lib/europcar/reservationMetrics.ts';
import { calcCommission, isAdminRole, isSellerRole, isSellerOnlyRole, normalizeUserRole } from '../src/lib/sellerCommission.ts';
import { buildCreateVoucherXml, buildReservationPaymentAttrs } from '../src/lib/europcar/paymentMapping.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function reservationOf(xml) {
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  return parsed.message.serviceResponse.reservation;
}

function captureLogger() {
  const messages = [];
  return { messages, logger: { warn: (m) => messages.push(String(m)) } };
}

const BA = '<payer ba="73804373" />';
const DVR = '<payer dvrName="Maria Condutora" />';

function line({ ty, desc, eur, brl, payer, auxK = '' }) {
  const aux = auxK ? ` auxK="${auxK}"` : '';
  return `<chargeLine act="AS"${aux} chrgTy="${ty}" chrgTyDesc="${desc}" price="${eur}" priceInBookingCurrency="${brl}">${payer}</chargeLine>`;
}

function buildXml({ resNumber, lines, payers, totalBRL, totalEUR, isPriceSecret = 'N', insurances = '' }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceResponse returnCode="OK">
    <reservation resNumber="${resNumber}" carCategory="MDMR">
      <quote areTaxesIncluded="Y" bookingCurrencyOfTotalRateEstimate="BRL" currency="EUR" isPrepaid="N" isPriceSecret="${isPriceSecret}" rentingCurrencyOfTotalRateEstimate="EUR" totalRateEstimate="${totalEUR}" totalRateEstimateInBookingCurrency="${totalBRL}" totalRateEstimateInRentingCurrency="${totalEUR}">
        <insuranceList>${insurances}</insuranceList>
        <chargeList>${lines.join('')}</chargeList>
        <payerList>${payers.join('')}</payerList>
      </quote>
    </reservation>
  </serviceResponse>
</message>`;
}

function payerBA(brl, eur) {
  return `<payer ba="73804373" chargeAllocatedInBookingCurrency="${brl}" chargeAllocatedInRentingCurrency="${eur}" dueToPayInBookingCurrency="${brl}" dueToPayInRentingCurrency="${eur}" />`;
}
function payerDVR(brl, eur) {
  return `<payer chargeAllocatedInBookingCurrency="${brl}" chargeAllocatedInRentingCurrency="${eur}" dueToPayInBookingCurrency="${brl}" dueToPayInRentingCurrency="${eur}" dvrName="Maria Condutora" />`;
}

// ── Reserva 1208543518 (caso da especificação) ───────────────────────────────

const XML_1208543518 = buildXml({
  resNumber: '1208543518',
  totalBRL: '1462.83',
  totalEUR: '251.67',
  isPriceSecret: 'Y',
  insurances: [
    '<insurance bkExcessWithPOM="11043.74" code="CDW" excessWithPOM="1900.00" price="0.00" priceInBookingCurrency="0.00" type="I" />',
    '<insurance bkExcessWithPOM="16914.36" code="THW" excessWithPOM="2910.00" price="0.00" priceInBookingCurrency="0.00" type="I" />',
    '<insurance bkExcessWithPOM="0.00" code="WWI" excessWithPOM="0.00" price="5.00" priceInBookingCurrency="29.06" type="O" />',
  ].join(''),
  lines: [
    line({ ty: '00001', desc: 'Basic Rental', eur: '186.94', brl: '1086.59', payer: BA }),
    line({ ty: '00024', desc: 'AIRPORT SURCHARGE', eur: '9.35', brl: '54.35', payer: BA, auxK: '5101' }),
    line({ ty: '00028', desc: 'VAT', eur: '43.18', brl: '250.98', payer: BA, auxK: '73804373' }),
    line({ ty: '00065', desc: 'One-Way Charge', eur: '10.00', brl: '58.12', payer: DVR }),
    line({ ty: '00028', desc: 'VAT', eur: '2.20', brl: '12.79', payer: DVR }),
    line({ ty: '00006', desc: 'ACCIDENT &amp; DAMAGE PROTECTION', eur: '0.00', brl: '0.00', payer: BA, auxK: 'CDW' }),
    line({ ty: '00008', desc: 'THEFT PROTECTION', eur: '0.00', brl: '0.00', payer: BA, auxK: 'THW' }),
    line({ ty: '00090', desc: 'LICENSES &amp; FEES', eur: '0.00', brl: '0.00', payer: BA, auxK: 'LAF' }),
    line({ ty: '00048', desc: 'Basic Rental-Free Miles', eur: '0.00', brl: '0.00', payer: DVR }),
  ],
  payers: [payerBA('1391.92', '239.47'), payerDVR('70.91', '12.20')],
});

test('1208543518 — separa on-line (ba) e balcão (dvrName) por linha', async () => {
  const { logger, messages } = captureLogger();
  const split = computePaymentSplit(await reservationOf(XML_1208543518), { logger });

  assert.ok(split);
  assert.equal(split.resNumber, '1208543518');
  assert.equal(split.isPriceSecret, true);

  // On-line
  assert.deepEqual(
    split.online.lines.map((l) => [l.label, l.priceBRL]),
    [['Diárias', 1086.59], ['Taxa de aeroporto', 54.35], ['Impostos (IVA)', 250.98]],
  );
  assert.equal(split.online.subtotalBRL, 1391.92);
  assert.equal(split.online.subtotalLocal, 239.47);
  assert.equal(formatBRLWithLocal(split.online.subtotalBRL, split.online.subtotalLocal, 'EUR'), 'R$ 1.391,92 (€ 239,47)');

  // Balcão
  assert.deepEqual(
    split.counter.lines.map((l) => [l.label, l.priceBRL]),
    [['Taxa de devolução em outra loja', 58.12], ['Impostos (IVA)', 12.79]],
  );
  assert.equal(split.counter.subtotalBRL, 70.91);
  assert.equal(split.counter.subtotalLocal, 12.2);
  assert.equal(formatBRLWithLocal(split.counter.subtotalBRL, split.counter.subtotalLocal, 'EUR'), 'R$ 70,91 (€ 12,20)');

  // Total
  assert.equal(split.totalBRL, 1462.83);
  assert.equal(split.totalLocal, 251.67);
  assert.equal(split.totalMatches, true);
  assert.equal(formatBRLWithLocal(split.totalBRL, split.totalLocal, 'EUR'), 'R$ 1.462,83 (€ 251,67)');

  // Incluso (0,00) com franquia — distribuído no bloco on-line (pois tem BA)
  assert.deepEqual(
    split.online.included.map((i) => [i.label, includedExcessText(i, 'EUR'), i.side]),
    [
      ['Proteção contra danos', 'franquia € 1.900,00', 'online'],
      ['Proteção contra roubo', 'franquia € 2.910,00', 'online'],
      ['Taxas e licenças', '', 'online'],
    ],
  );
  assert.deepEqual(split.counter.included, []);

  // Incluso combinado (legado / compatibilidade)
  assert.deepEqual(
    split.included.map((i) => [i.label, includedExcessText(i, 'EUR')]),
    [
      ['Proteção contra danos', 'franquia € 1.900,00'],
      ['Proteção contra roubo', 'franquia € 2.910,00'],
      ['Taxas e licenças', ''],
    ],
  );

  // Sem alertas e sem linhas 0,00 nos blocos
  assert.deepEqual(split.alerts, []);
  assert.equal(messages.filter((m) => m.includes('diverge')).length, 0);
  assert.ok([...split.online.lines, ...split.counter.lines].every((l) => l.priceBRL !== 0));
});

test('itens inclusos a 0,00 com payer dvrName vão para o bloco do balcão', async () => {
  const xml = buildXml({
    resNumber: '1000000004',
    totalBRL: '1086.59',
    totalEUR: '186.94',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '186.94', brl: '1086.59', payer: BA }),
      line({ ty: '00006', desc: 'ACCIDENT &amp; DAMAGE PROTECTION', eur: '0.00', brl: '0.00', payer: BA, auxK: 'CDW' }),
      line({ ty: '00090', desc: 'LICENSES &amp; FEES', eur: '0.00', brl: '0.00', payer: DVR, auxK: 'LAF' }),
    ],
    payers: [payerBA('1086.59', '186.94')],
  });

  const split = computePaymentSplit(await reservationOf(xml), { logger: null });
  assert.ok(split);
  assert.equal(split.online.included.length, 1);
  assert.equal(split.online.included[0].label, 'Proteção contra danos');
  assert.equal(split.online.included[0].side, 'online');

  assert.ok(split.counter);
  assert.equal(split.counter.included.length, 1);
  assert.equal(split.counter.included[0].label, 'Taxas e licenças');
  assert.equal(split.counter.included[0].side, 'counter');
});

test('1208543518 — markup (margem ETO) preserva total do pacote (netTotal * markup) menos balcão', async () => {
  const split = computePaymentSplit(await reservationOf(XML_1208543518), { onlineMarkupPercent: 10, logger: null });
  assert.equal(split.online.netSubtotalBRL, 1391.92);
  // Total líquido 1462,83 * 1,10 = 1609,11. Balcão = 70,91. Online = 1609,11 - 70,91 = 1538,20.
  assert.equal(split.online.subtotalBRL, 1538.20);
  const linesSum = Math.round(split.online.lines.reduce((s, l) => s + l.priceBRL, 0) * 100) / 100;
  assert.equal(linesSum, split.online.subtotalBRL);
  assert.equal(split.counter.subtotalBRL, 70.91); // balcão nunca recebe markup
  assert.equal(split.totalBRL, 1609.11);
  assert.equal(split.netTotalBRL, 1462.83);
  assert.equal(split.totalMatches, true);
});

test('Milão Linate (LINT01) — confere 100% com o portal B2B Europcar Tour Operator', async () => {
  // Simula o XML da cotação de Milão Linate (CDMR - KIA Stonic)
  // Total Líquido XRS: 64,84 EUR / 415,78 BRL
  // Balcão (Driver): Snow Chains 24,00 EUR (153,88 BRL) + Airport 1,39 EUR (8,91 BRL) + VAT 5,59 EUR (35,86 BRL) = 30,98 EUR / 198,65 BRL
  // Online (BA): Diárias 27,76 EUR (177,98 BRL) + VAT 6,10 EUR (39,14 BRL) = 33,86 EUR / 217,12 BRL
  const xmlMilao = buildXml({
    resNumber: '1208999999',
    totalBRL: '415.78',
    totalEUR: '64.84',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '27.76', brl: '177.98', payer: BA }),
      line({ ty: '00028', desc: 'VAT', eur: '6.10', brl: '39.14', payer: BA }),
      line({ ty: '00024', desc: 'Airport Surcharge', eur: '1.39', brl: '8.91', payer: DVR }),
      line({ ty: '00621', desc: 'Snow chains Italy', eur: '24.00', brl: '153.88', payer: DVR, auxK: 'WINT' }),
      line({ ty: '00028', desc: 'VAT', eur: '5.59', brl: '35.86', payer: DVR }),
    ],
    payers: [payerBA('217.12', '33.86'), payerDVR('198.65', '30.98')],
  });

  // Margem da Itália: 25%
  const split = computePaymentSplit(await reservationOf(xmlMilao), { onlineMarkupPercent: 25, logger: null });

  assert.ok(split);
  // Total pacote garantido: 64,84 EUR * 1.25 = 81,05 EUR / 415,78 BRL * 1.25 = 519,72 BRL
  assert.equal(split.totalLocal, 81.05);
  assert.equal(split.totalBRL, 519.72);

  // A pagar no balcão na chegada (garantido): 30,98 EUR / 198,65 BRL
  assert.equal(split.counter.subtotalLocal, 30.98);
  assert.equal(split.counter.subtotalBRL, 198.65);

  // A pagar ao Tour Operator online: 81,05 - 30,98 = 50,07 EUR / 519,72 - 198,65 = 321,07 BRL
  assert.equal(split.online.subtotalLocal, 50.07);
  assert.equal(split.online.subtotalBRL, 321.07);

  // Soma das linhas bate rigorosamente com o subtotal
  const onlineLinesSum = Math.round(split.online.lines.reduce((s, l) => s + l.priceBRL, 0) * 100) / 100;
  assert.equal(onlineLinesSum, 321.07);
});

test('Milão Linate (LINT01) com Franquia Zero — total fecha rigorosamente em R$ 722,00 (112,63 EUR)', async () => {
  // Simula a cotação real de Milão Linate com Fiat Panda (MDMR) e Franquia Zero (CID 56935495)
  // Total Líquido XRS: 90,10 EUR / 577,60 BRL
  // Balcão (Driver): Snow Chains 24,00 EUR (153,88 BRL) + Airport 1,39 EUR (8,91 BRL) + VAT 5,59 EUR (35,86 BRL) = 30,98 EUR / 198,65 BRL
  // Online (BA): Diárias + Franquia Zero = 59,12 EUR / 378,95 BRL
  const xmlMilaoZero = buildXml({
    resNumber: '1208999995',
    totalBRL: '577.60',
    totalEUR: '90.10',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '35.00', brl: '224.35', payer: BA }),
      line({ ty: '00010', desc: 'Zero Excess', eur: '18.00', brl: '115.38', payer: BA }),
      line({ ty: '00028', desc: 'VAT', eur: '6.12', brl: '39.22', payer: BA }),
      line({ ty: '00024', desc: 'Airport Surcharge', eur: '1.39', brl: '8.91', payer: DVR }),
      line({ ty: '00621', desc: 'Snow chains Italy', eur: '24.00', brl: '153.88', payer: DVR, auxK: 'WINT' }),
      line({ ty: '00028', desc: 'VAT', eur: '5.59', brl: '35.86', payer: DVR }),
    ],
    payers: ['<payer ba="73804373" dueToPayInBookingCurrency="378.95" dueToPay="59.12"/>', '<payer dvrName="Driver" dueToPayInBookingCurrency="198.65" dueToPay="30.98"/>'],
  });

  const splitZero = computePaymentSplit(await reservationOf(xmlMilaoZero), { onlineMarkupPercent: 25, isZeroExcess: true, logger: null });

  assert.ok(splitZero);
  // Total pacote garantido com 25% de margem: 577,60 * 1,25 = 722,00 BRL / 90,10 * 1,25 = 112,63 EUR
  assert.equal(splitZero.totalBRL, 722);
  assert.equal(splitZero.totalLocal, 112.63);

  // A pagar no balcão na chegada (Snow chains obrigatório + aeroporto): 198,65 BRL / 30,98 EUR
  assert.equal(splitZero.counter.subtotalBRL, 198.65);
  assert.equal(splitZero.counter.subtotalLocal, 30.98);

  // A pagar online ao Tour Operator: 722,00 - 198,65 = 523,35 BRL / 112,63 - 30,98 = 81,65 EUR
  assert.equal(splitZero.online.subtotalBRL, 523.35);
  assert.equal(splitZero.online.subtotalLocal, 81.65);
});

test('Extras adicionados (equipamentos e proteções) NUNCA recebem markup comercial', async () => {
  // Cenário 1: Equipamento (Cadeira de Bebê - CST) adicionado no balcão
  const xmlWithEquip = buildXml({
    resNumber: '1208999998',
    totalBRL: '735.78', // 415.78 base + 320.00 cadeira de bebê
    totalEUR: '114.84', // 64.84 base + 50.00 cadeira de bebê
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '27.76', brl: '177.98', payer: BA }),
      line({ ty: '00028', desc: 'VAT', eur: '6.10', brl: '39.14', payer: BA }),
      line({ ty: '00024', desc: 'Airport Surcharge', eur: '1.39', brl: '8.91', payer: DVR }),
      line({ ty: '00621', desc: 'Snow chains Italy', eur: '24.00', brl: '153.88', payer: DVR, auxK: 'WINT' }),
      line({ ty: '00028', desc: 'VAT', eur: '5.59', brl: '35.86', payer: DVR }),
      line({ ty: '00020', desc: 'CHILD SAFETY SEAT', eur: '50.00', brl: '320.00', payer: DVR, auxK: 'CST' }),
    ],
    payers: [payerBA('217.12', '33.86'), payerDVR('518.65', '80.98')],
  });

  const splitEquip = computePaymentSplit(await reservationOf(xmlWithEquip), {
    onlineMarkupPercent: 25,
    extraCodes: ['CST'],
    logger: null,
  });

  assert.ok(splitEquip);
  // O online NÃO deve ser inflado pelo equipamento no balcão (continua 321,07 BRL / 50,07 EUR)
  assert.equal(splitEquip.online.subtotalLocal, 50.07);
  assert.equal(splitEquip.online.subtotalBRL, 321.07);
  // O balcão deve ter o balcão base (198,65) + equipamento facial sem margem (320,00) = 518,65
  assert.equal(splitEquip.counter.subtotalBRL, 518.65);
  assert.equal(splitEquip.counter.subtotalLocal, 80.98);
  // Total da reserva = 519,72 (carro) + 320,00 (cadeira) = 839,72 BRL (131,05 EUR)
  assert.equal(splitEquip.totalBRL, 839.72);
  assert.equal(splitEquip.totalLocal, 131.05);

  // Cenário 2: Proteção opcional (WWI - Vidros e Pneus) adicionada no pagamento on-line
  const xmlWithWWI = buildXml({
    resNumber: '1208999997',
    totalBRL: '509.25', // 415.78 base + 93.47 WWI
    totalEUR: '79.42',  // 64.84 base + 14.58 WWI
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '27.76', brl: '177.98', payer: BA }),
      line({ ty: '00028', desc: 'VAT', eur: '6.10', brl: '39.14', payer: BA }),
      line({ ty: '00024', desc: 'Airport Surcharge', eur: '1.39', brl: '8.91', payer: DVR }),
      line({ ty: '00621', desc: 'Snow chains Italy', eur: '24.00', brl: '153.88', payer: DVR, auxK: 'WINT' }),
      line({ ty: '00028', desc: 'VAT', eur: '5.59', brl: '35.86', payer: DVR }),
      line({ ty: '00010', desc: 'WHEELS AND WINDSCREEN PROTECTION', eur: '14.58', brl: '93.47', payer: BA, auxK: 'WWI' }),
    ],
    payers: [payerBA('310.59', '48.44'), payerDVR('198.65', '30.98')],
  });

  const splitWWI = computePaymentSplit(await reservationOf(xmlWithWWI), {
    onlineMarkupPercent: 25,
    extraCodes: ['WWI'],
    logger: null,
  });

  assert.ok(splitWWI);
  // O balcão permanece exatamente o mesmo (198,65 BRL / 30,98 EUR)
  assert.equal(splitWWI.counter.subtotalLocal, 30.98);
  assert.equal(splitWWI.counter.subtotalBRL, 198.65);
  // O on-line deve ser o online base (321,07) + WWI sem markup (93,47) = 414,54 BRL (64,65 EUR)
  assert.equal(splitWWI.online.subtotalBRL, 414.54);
  assert.equal(splitWWI.online.subtotalLocal, 64.65);
  // A linha específica do WWI no detalhamento on-line NUNCA recebe markup (permanece 93,47 BRL)
  const wwiLine = splitWWI.online.lines.find((l) => l.auxK === 'WWI');
  assert.ok(wwiLine);
  assert.equal(wwiLine.priceBRL, 93.47);
  assert.equal(wwiLine.priceLocal, 14.58);
  // Total da reserva = 519,72 (carro) + 93.47 (WWI sem markup) = 613,19 BRL (95,63 EUR)
  assert.equal(splitWWI.totalBRL, 613.19);
  assert.equal(splitWWI.totalLocal, 95.63);
});

test('Lisboa (LIST01) com Condutor Adicional — total confere com o Passo 3 (336,27 BRL) sem inflar para 376,89 BRL', async () => {
  // Simula a cotação real de Lisboa com Citroen C3 + Condutor Adicional (ADD)
  // Total Líquido XRS: 47,02 EUR / 301,51 BRL
  // Carro base líquido: 21,72 EUR / 139,28 BRL
  // Condutor adicional (ADD): 25,30 EUR / 162,17 BRL
  // Margem de Portugal: 25% (deve incidir SOMENTE sobre o carro 139,28 -> 174,10)
  const xmlLisboa = buildXml({
    resNumber: '1208999996',
    totalBRL: '301.51',
    totalEUR: '47.02',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '15.36', brl: '98.50', payer: BA }),
      line({ ty: '00028', desc: 'VAT', eur: '3.53', brl: '22.63', payer: BA }),
      line({ ty: '00024', desc: 'Airport Surcharge', eur: '2.30', brl: '14.75', payer: DVR }),
      line({ ty: '00076', desc: 'ADDITIONAL DRIVER', eur: '17.88', brl: '114.65', payer: DVR, auxK: 'ADD' }),
      line({ ty: '00028', desc: 'VAT', eur: '7.95', brl: '50.98', payer: DVR }),
    ],
    payers: [payerBA('121.13', '18.89'), payerDVR('180.38', '28.13')],
  });

  const split = computePaymentSplit(await reservationOf(xmlLisboa), {
    onlineMarkupPercent: 25,
    extraCodes: ['ADD', 'ADR'],
    knownExtrasBRL: 162.17,
    knownExtrasLocal: 25.30,
    logger: null,
  });

  assert.ok(split);
  // O on-line deve ser o carro base com margem (174,18) - aeroporto no balcão (18,21) = 155,97 BRL (24,32 EUR)
  // NUNCA 196,51 BRL (que conteria +40,56 de margem do condutor adicional)!
  assert.equal(split.online.subtotalBRL, 155.97);
  assert.equal(split.online.subtotalLocal, 24.32);

  // O balcão deve ser 180,38 BRL (28,13 EUR) = aeroporto 18,15 + condutor adicional 162,23
  assert.equal(split.counter.subtotalBRL, 180.38);
  assert.equal(split.counter.subtotalLocal, 28.13);

  // O total da reserva deve ser 155,97 + 180,38 = 336,35 BRL (52,45 EUR)
  // Bate exatamente com os 336,27 BRL do Passo 3 (diferença ínfima de centavos de câmbio)
  // NUNCA 376,89 BRL!
  assert.equal(split.totalBRL, 336.35);
  assert.equal(split.totalLocal, 52.45);
});

test('POA com item mandatório (ex: Snow Chains em Milão) — valor do carro base + item mandatório bate com o Passo 3 e Checkout', () => {
  // Simula o cálculo da tarifa POA em Milão Linate (LINT01)
  // Carro base XRS: 50.00 EUR / 321.07 BRL
  // Item mandatório (Snow Chains - SNC): 24.00 EUR / 153.88 BRL + IVA 22% (5.28 EUR / 33.85 BRL) = 29.28 EUR / 187.73 BRL
  const baseVehicleBRL = 321.07;
  const baseVehicleLocal = 50.00;
  const mandatoryBRL = 187.73;
  const mandatoryLocal = 29.28;

  // Passo 2 e 3: Tarifa POA somada
  const step2TotalBRL = Math.round((baseVehicleBRL + mandatoryBRL) * 100) / 100;
  const step2TotalLocal = Math.round((baseVehicleLocal + mandatoryLocal) * 100) / 100;

  assert.equal(step2TotalBRL, 508.80);
  assert.equal(step2TotalLocal, 79.28);

  // Checkout resumo de caixa (PAGAR NA RETIRADA):
  // Aluguel do veículo: 321,07 BRL (50,00 EUR)
  // Correntes de neve (Obrigatório): 187,73 BRL (29,28 EUR)
  // Total a pagar no balcão bate exatamente com o Passo 2 e Passo 3:
  const checkoutBalcaoTotalBRL = Math.round((baseVehicleBRL + mandatoryBRL) * 100) / 100;
  const checkoutBalcaoTotalLocal = Math.round((baseVehicleLocal + mandatoryLocal) * 100) / 100;

  assert.equal(checkoutBalcaoTotalBRL, step2TotalBRL);
  assert.equal(checkoutBalcaoTotalLocal, step2TotalLocal);
});

// ── Cenário 1: tudo com ba ───────────────────────────────────────────────────

test('cenário 1 — todas as linhas com ba → só bloco on-line', async () => {
  const xml = buildXml({
    resNumber: '1000000001',
    totalBRL: '1006.34',
    totalEUR: '172.70',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '115.04', brl: '670.35', payer: BA }),
      line({ ty: '00024', desc: 'Airport Surcharge', eur: '19.69', brl: '114.74', payer: BA }),
      line({ ty: '00621', desc: 'ECOLOGICAL FEES', eur: '8.00', brl: '46.62', payer: BA, auxK: 'ECOLOGIC' }),
      line({ ty: '00028', desc: 'VAT', eur: '29.97', brl: '174.63', payer: BA }),
      line({ ty: '00028', desc: 'VAT', eur: '0.00', brl: '0.00', payer: DVR }),
    ],
    payers: [payerBA('1006.34', '172.70'), payerDVR('0.00', '0.00')],
  });
  const { logger, messages } = captureLogger();
  const split = computePaymentSplit(await reservationOf(xml), { logger });

  assert.ok(split.online);
  assert.equal(split.counter, null);
  assert.equal(split.online.subtotalBRL, 1006.34);
  assert.equal(split.totalBRL, 1006.34);
  assert.equal(split.online.lines.find((l) => l.chrgTy === '00024').label, 'Taxa de aeroporto'); // case-insensitive
  // Descrição não mapeada → texto original + log
  assert.equal(split.online.lines.find((l) => l.chrgTy === '00621').label, 'ECOLOGICAL FEES');
  assert.deepEqual(split.unmappedDescriptions, ['ECOLOGICAL FEES']);
  assert.ok(messages.some((m) => m.includes('sem tradução') && m.includes('ECOLOGICAL FEES')));
  assert.deepEqual(split.alerts, []);
});

// ── Cenário 2: nenhuma linha com ba ──────────────────────────────────────────

test('cenário 2 — nenhuma linha com ba → só bloco do balcão', async () => {
  const xml = buildXml({
    resNumber: '1000000002',
    totalBRL: '640.20',
    totalEUR: '110.00',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '80.00', brl: '465.60', payer: DVR }),
      line({ ty: '00030', desc: 'HIGH SEASON SURCHARGE', eur: '10.91', brl: '63.50', payer: DVR }),
      line({ ty: '00028', desc: 'VAT', eur: '19.09', brl: '111.10', payer: DVR }),
    ],
    payers: [payerDVR('640.20', '110.00')],
  });
  const split = computePaymentSplit(await reservationOf(xml), { logger: null });

  assert.equal(split.online, null);
  assert.ok(split.counter);
  assert.equal(split.counter.subtotalBRL, 640.2);
  assert.equal(split.counter.subtotalLocal, 110);
  assert.deepEqual(split.counter.lines.map((l) => l.label), ['Diárias', 'Sobretaxa de alta temporada', 'Impostos (IVA)']);
  assert.equal(split.totalMatches, true);
  assert.equal(counterNotice(split.localCurrency), 'Este valor será cobrado na retirada do veículo, em EUR, no cartão do condutor.');
});

// ── Cenário 3: soma das linhas diverge do payerList ──────────────────────────

test('cenário 3 — soma divergente do payerList → usa payerList e grava alerta com resNumber', async () => {
  const xml = buildXml({
    resNumber: '1000000003',
    totalBRL: '1462.83',
    totalEUR: '251.67',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '186.94', brl: '1086.59', payer: BA }),
      line({ ty: '00028', desc: 'VAT', eur: '43.18', brl: '250.98', payer: BA }), // falta a taxa de aeroporto
      line({ ty: '00065', desc: 'One-Way Charge', eur: '10.00', brl: '58.12', payer: DVR }),
      line({ ty: '00028', desc: 'VAT', eur: '2.20', brl: '12.79', payer: DVR }),
    ],
    payers: [payerBA('1391.92', '239.47'), payerDVR('70.91', '12.20')],
  });
  const { logger, messages } = captureLogger();
  const split = computePaymentSplit(await reservationOf(xml), { logger });

  assert.equal(split.online.mismatch, true);
  assert.equal(split.online.linesSumBRL, 1337.57);
  assert.equal(split.online.subtotalBRL, 1391.92); // vale o payerList
  assert.equal(split.online.subtotalLocal, 239.47);
  assert.equal(split.counter.mismatch, false);
  assert.ok(split.alerts.length >= 1);
  const alertLogs = messages.filter((m) => m.includes('diverge'));
  assert.ok(alertLogs.length >= 1);
  assert.ok(alertLogs.every((m) => m.includes('resNumber=1000000003')));
  // Total do payerList continua batendo com o totalRateEstimate
  assert.equal(split.totalMatches, true);
});

// ── Formatação ───────────────────────────────────────────────────────────────

test('formatação BRL e EUR', () => {
  assert.equal(formatBRL(1391.92), 'R$ 1.391,92');
  assert.equal(formatBRL(11043.74), 'R$ 11.043,74');
  assert.equal(formatMoney(239.47, 'EUR'), '€ 239,47');
  assert.equal(formatMoney(0, 'EUR'), '€ 0,00');
});

test('quando isZeroExcess é true, oculta proteções básicas com franquia e exibe Proteção Premium — Franquia Zero', async () => {
  const xml = XML_1208543518;
  const standardSplit = computePaymentSplit(await reservationOf(xml), { isZeroExcess: false, logger: null });
  // Sem franquia zero: exibe as proteções básicas com franquia
  assert.ok(standardSplit.online.included.some((i) => i.label === 'Proteção contra danos'));
  assert.ok(standardSplit.online.included.some((i) => i.label === 'Proteção contra roubo'));
  assert.ok(!standardSplit.online.included.some((i) => i.label.includes('Franquia Zero')));

  // Com franquia zero (Proteção Premium): oculta as proteções básicas e exibe Proteção Premium — Franquia Zero
  const zeroSplit = computePaymentSplit(await reservationOf(xml), { isZeroExcess: true, logger: null });
  assert.equal(zeroSplit.isZeroExcess, true);
  assert.ok(!zeroSplit.online.included.some((i) => i.label === 'Proteção contra danos'));
  assert.ok(!zeroSplit.online.included.some((i) => i.label === 'Proteção contra roubo'));
  assert.ok(zeroSplit.online.included.some((i) => i.label === 'Proteção Premium — Franquia Zero'));
  assert.ok(zeroSplit.online.included.some((i) => i.label === 'Taxas e licenças'));
});

test('quando isZeroExcess é true com PREMIUM PROTECTION PACKAGE no XML, remove a linha duplicada e mantém só a Franquia Zero', async () => {
  const xml = buildXml({
    resNumber: '1000000009',
    totalBRL: '539.48',
    totalEUR: '92.73',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '92.73', brl: '539.48', payer: BA }),
      line({ ty: '00006', desc: 'PREMIUM PROTECTION PACKAGE', eur: '0.00', brl: '0.00', payer: BA, auxK: 'PPP' }),
      line({ ty: '00090', desc: 'LICENSES &amp; FEES', eur: '0.00', brl: '0.00', payer: BA, auxK: 'LAF' }),
    ],
    payers: [payerBA('539.48', '92.73')],
  });

  const split = computePaymentSplit(await reservationOf(xml), { isZeroExcess: true, logger: null });
  assert.ok(split);
  assert.ok(split.online.included.some((i) => i.label === 'Proteção Premium — Franquia Zero'));
  assert.ok(!split.online.included.some((i) => i.label === 'PREMIUM PROTECTION PACKAGE'));
  assert.ok(split.online.included.some((i) => i.label === 'Taxas e licenças'));
});

test('EmailSummaryConfig — padrão mantém 100% dos blocos ativos e normalizeEmailSummaryConfig preenche defaults', () => {
  assert.equal(DEFAULT_EMAIL_SUMMARY_CONFIG.cashSummary.online.enabled, true);
  assert.equal(DEFAULT_EMAIL_SUMMARY_CONFIG.cashSummary.counter.enabled, true);
  assert.equal(DEFAULT_EMAIL_SUMMARY_CONFIG.cashSummary.total.enabled, true);
  assert.equal(DEFAULT_EMAIL_SUMMARY_CONFIG.sections.franchiseBlock, true);
  assert.equal(DEFAULT_EMAIL_SUMMARY_CONFIG.sections.section01, true);
  assert.equal(DEFAULT_EMAIL_SUMMARY_CONFIG.sections.section04, true);

  const normalized = normalizeEmailSummaryConfig({});
  assert.equal(normalized.cashSummary.online.enabled, true);
  assert.equal(normalized.cashSummary.online.title, 'Pagar on-line');
  assert.equal(normalized.sections.franchiseBlock, true);
});

test('filterEmailHtmlByConfig — remove blocos e seções conforme configuração personalizada', () => {
  const sampleHtml = `
<!-- FRANQUIA, CAUÇÃO E COBRANÇAS -->
<tr><td class="px"><p>Franquia, caução e cobranças</p>
<p>Franquia das proteções contratadas</p><p>• Franquia zero</p>
<p>O que a proteção não cobre</p><p>Exclusões aqui</p>
</td></tr>
<!-- ALERTA DOCUMENTOS -->
<tr><td class="px">Na retirada apresente este e-mail e documento</td></tr>
<tr><td class="px">01   Sua reserva<br>Informações importantes</td></tr>
<!-- SUPORTE -->
<tr><td class="px">Dúvidas? Acesse europcar.com.br/reservas</td></tr>
`;

  // Com tudo ligado: nada é removido
  const full = filterEmailHtmlByConfig(sampleHtml, DEFAULT_EMAIL_SUMMARY_CONFIG);
  assert.ok(full.includes('Franquia, caução e cobranças'));
  assert.ok(full.includes('Na retirada apresente este e-mail'));
  assert.ok(full.includes('01   Sua reserva'));
  assert.ok(full.includes('europcar.com.br/reservas'));

  // Com franquia e alerta desligados
  const customCfg = {
    ...DEFAULT_EMAIL_SUMMARY_CONFIG,
    sections: {
      ...DEFAULT_EMAIL_SUMMARY_CONFIG.sections,
      franchiseBlock: false,
      documentAlert: false,
      section01: false,
      supportLink: false,
    },
  };
  const filtered = filterEmailHtmlByConfig(sampleHtml, customCfg);
  assert.ok(!filtered.includes('Franquia, caução e cobranças'));
  assert.ok(!filtered.includes('Na retirada apresente este e-mail'));
  assert.ok(!filtered.includes('01   Sua reserva'));
  assert.ok(!filtered.includes('europcar.com.br/reservas'));
});

test('POA IATA — envia IATANumber 02170722 nas reservas POA / EXO com payload VCH completo no GW', () => {
  const DEFAULT_POA_IATA = '02170722';
  assert.equal(DEFAULT_POA_IATA, '02170722');

  const xmlDefault = buildCreateVoucherXml(
    '1208543518',
    { type: 'EXO', iataNumber: DEFAULT_POA_IATA },
    '100.00',
    'EUR',
    'MDMR',
    '20261101',
    '20261108',
  );

  assert.ok(xmlDefault.includes('serviceCode="createVoucher"'));
  assert.ok(xmlDefault.includes('resNumber="1208543518"'));
  assert.ok(xmlDefault.includes('voucherType="EXO"'));
  assert.ok(xmlDefault.includes('IATANumber="02170722"'));
  assert.ok(xmlDefault.includes('voucherAmount="100.00"'));
  assert.ok(xmlDefault.includes('voucherCurrency="EUR"'));
  assert.ok(xmlDefault.includes('voucherCarCategory="MDMR"'));
  assert.ok(xmlDefault.includes('voucherRentalDuration="7"'));
  assert.ok(xmlDefault.includes('voucherID='));

  // Custom IATA alterado no painel administrativo
  const xmlCustom = buildCreateVoucherXml(
    '1208543519',
    { type: 'EXO', iataNumber: '99887766' },
    '250.50',
    'EUR',
    'CDMR',
    '20261101',
    '20261104',
  );
  assert.ok(xmlCustom.includes('IATANumber="99887766"'));
  assert.ok(xmlCustom.includes('voucherAmount="250.50"'));
  assert.ok(xmlCustom.includes('voucherCarCategory="CDMR"'));
  assert.ok(xmlCustom.includes('voucherRentalDuration="3"'));
});

test('quando isZeroExcess é true com SUPER THEFT WAIVER CHARGE no XML, oculta do resumo e mantém apenas Franquia Zero', async () => {
  const xml = buildXml({
    resNumber: '1000000010',
    totalBRL: '495.04',
    totalEUR: '85.09',
    lines: [
      line({ ty: '00001', desc: 'Basic Rental', eur: '85.09', brl: '495.04', payer: BA }),
      line({ ty: '00021', desc: 'SUPER THEFT WAIVER CHARGE', eur: '0.00', brl: '0.00', payer: BA, auxK: 'STHW' }),
      line({ ty: '00090', desc: 'LICENSES &amp; FEES', eur: '0.00', brl: '0.00', payer: BA, auxK: 'LAF' }),
    ],
    payers: [payerBA('495.04', '85.09')],
  });

  const split = computePaymentSplit(await reservationOf(xml), { isZeroExcess: true, logger: null });
  assert.ok(split);
  assert.equal(split.isZeroExcess, true);

  // Deve conter Proteção Premium — Franquia Zero
  assert.ok(split.online.included.some((i) => i.label === 'Proteção Premium — Franquia Zero'));

  // NÃO pode conter SUPER THEFT WAIVER CHARGE nem STHW
  assert.ok(!split.online.included.some((i) => /theft/i.test(i.label)));
  assert.ok(!split.online.included.some((i) => i.code === 'STHW'));

  // Taxas e licenças continua presente
  assert.ok(split.online.included.some((i) => i.label === 'Taxas e licenças'));
});
// ── Testes de Métricas de Reserva no Painel (/painel) ────────────────────────

test('computeReservationMetrics prioriza paymentSplit de customerData e calcula totalGeral, online e balcão com precisão', () => {
  const dummyRes = {
    id: 'res-split-001',
    resNumber: '1208543518',
    status: 'CONFIRMED',
    amountInCents: 139192, // R$ 1.391,92 pago online no cartão/PIX
    bookingResponse: JSON.stringify({
      reservation: {
        quote: {
          totalRateEstimate: '251.67',
          totalRateEstimateInBookingCurrency: '1462.83',
          currency: 'EUR',
          bookingCurrencyOfTotalRateEstimate: 'BRL',
        },
      },
    }),
    customerData: JSON.stringify({
      paymentSplit: {
        online: {
          subtotalBRL: 1391.92,
          subtotalLocal: 239.47,
          currencyLocal: 'EUR',
          items: [{ label: 'Diárias', brl: 1391.92, local: 239.47 }],
        },
        counter: {
          subtotalBRL: 70.91,
          subtotalLocal: 12.20,
          currencyLocal: 'EUR',
          items: [{ label: 'Taxa de Devolução (One-Way)', brl: 70.91, local: 12.20 }],
        },
        totalBRL: 1462.83,
        totalLocal: 251.67,
        currencyLocal: 'EUR',
        hasSplit: true,
      },
    }),
  };

  const metrics = computeReservationMetrics(dummyRes);

  assert.equal(metrics.hasSplit, true);
  assert.equal(metrics.onlinePaidBRL, 1391.92);
  assert.equal(metrics.counterDueBRL, 70.91);
  assert.equal(metrics.totalGeralBRL, 1462.83);
  assert.equal(metrics.amountBRL, 1462.83); // Total do contrato deve bater com o total geral
  assert.equal(metrics.onlinePaidEUR, 239.47);
  assert.equal(metrics.counterDueEUR, 12.20);
  assert.equal(metrics.totalGeralEUR, 251.67);
  assert.equal(metrics.currencyLocal, 'EUR');
  assert.ok(metrics.counterNotice?.includes('12,20'));
});

test('computeReservationMetrics deriva valores corretamente mesmo sem customerData.paymentSplit (reserva legada)', () => {
  const dummyLegacyRes = {
    id: 'res-legacy-002',
    resNumber: '1208543519',
    status: 'CONFIRMED',
    amountInCents: 100000, // R$ 1.000,00 pago online
    bookingResponse: JSON.stringify({
      reservation: {
        quote: {
          totalRateEstimate: '200.00',
          totalRateEstimateInBookingCurrency: '1200.00', // Câmbio 6.00
          currency: 'EUR',
          bookingCurrencyOfTotalRateEstimate: 'BRL',
        },
      },
    }),
    customerData: '{}',
  };

  const metrics = computeReservationMetrics(dummyLegacyRes);

  assert.equal(metrics.hasSplit, true);
  assert.equal(metrics.onlinePaidBRL, 1000.00);
  assert.equal(metrics.counterDueBRL, 200.00); // 1200 - 1000 = 200
  assert.equal(metrics.totalGeralBRL, 1200.00);
  assert.equal(metrics.amountBRL, 1200.00);
  assert.equal(metrics.totalGeralEUR, 200.00);
  // Câmbio 1200 / 200 = 6.0 -> 200 BRL / 6 = 33.33 EUR
  assert.equal(metrics.counterDueEUR, 33.33);
  assert.equal(metrics.onlinePaidEUR, 166.67);
});

test('Reserva com equipamentos/acessórios no balcão: o valor a pagar na retirada NUNCA pode ser zerado', () => {
  // Simula o caso do cliente 1208542929:
  // - Pago no cartão online: R$ 937,13 (€ 161,23)
  // - Acessórios e equipamentos contratados: R$ 1.610,88 (€ 277,14)
  // - Câmbio: 1 EUR = R$ 5,8125
  const rate = 5.8125;
  const paidBRL = 937.13;
  const equipBRL = 1610.88;
  const equipEUR = +(equipBRL / rate).toFixed(2); // 277.14

  // Se o cliente pagou online o carro e contratou equipamentos para pagar na retirada:
  const counterBRL = equipBRL;
  const totalBRL = paidBRL + counterBRL;
  const totalEUR = +(totalBRL / rate).toFixed(2);

  assert.ok(counterBRL > 0, 'Valor de balcão deve ser maior que 0');
  assert.equal(equipEUR, 277.14);
  assert.equal(totalBRL, 2548.01);
  assert.equal(totalEUR, 438.37);

  // O texto do balcão não pode ser "Nada a pagar" ou "€ 0,00"
  const counterFormatted = `€ ${equipEUR.toFixed(2).replace('.', ',')} (≈ R$ ${equipBRL.toFixed(2).replace('.', ',')})`;
  assert.ok(!counterFormatted.includes('€ 0,00'));
  assert.ok(counterFormatted.includes('€ 277,14'));
  assert.ok(counterFormatted.includes('R$ 1610,88'));
});
test('Reserva BALCAO (isPrepaid=N, contractID=55138134, ex: 1208660280): valor online é 0 e balcão é o total da cotação', () => {
  const balcaoRes = {
    resNumber: '1208660280',
    status: 'CONFIRMED',
    paymentMethod: 'BALCAO',
    amountInCents: 53259, // total do contrato registrado no checkout
    bookingResponse: JSON.stringify({
      reservation: {
        contractID: '55138134',
        quote: {
          currency: 'BRL',
          bookingCurrencyOfTotalRateEstimate: 'BRL',
          totalRateEstimate: '532.59',
          totalRateEstimateInBookingCurrency: '532.59',
          isPrepaid: 'N',
          chargeList: {
            chargeLine: [
              { act: 'AS', chrgTy: '00001', chrgTyDesc: 'Basic Rental', price: '354.80', priceInBookingCurrency: '354.80' },
              { act: 'AS', chrgTy: '00005', chrgTyDesc: 'Basic Rental-Discount', price: '-35.48', priceInBookingCurrency: '-35.48' },
              { act: 'AS', chrgTy: '00079', chrgTyDesc: 'LOSS DAMAGE WAIVER', price: '143.80', priceInBookingCurrency: '143.80' },
              { act: 'AS', chrgTy: '00028', chrgTyDesc: 'VAT', price: '69.47', priceInBookingCurrency: '69.47' },
            ],
          },
          payerList: {
            payer: {
              chargeAllocatedInBookingCurrency: '532.59',
              dueToPayInBookingCurrency: '532.59',
              dvrName: 'Jeferson Oliveira',
            },
          },
        },
      },
    }),
    customerData: '{}',
  };

  const metrics = computeReservationMetrics(balcaoRes);

  assert.equal(metrics.paymentMethod, 'BALCAO');
  assert.equal(metrics.isPrepaid, false);
  assert.equal(metrics.isCounter, true);
  assert.equal(metrics.onlinePaidBRL, 0);
  assert.equal(metrics.counterDueBRL, 532.59);
  assert.equal(metrics.totalGeralBRL, 532.59);
  assert.equal(metrics.currencyLocal, 'BRL');
});

test('Reserva POA é SEMPRE no destino (prepaidMode="NP") e envia IATANumber para o GW', () => {
  // 1. Reserva POA BALCAO: prepaidMode="NP" (pagamento no destino) + IATANumber
  const poaBalcaoAttrs = buildReservationPaymentAttrs({
    method: 'BALCAO',
    captured: false,
    contractID: '57269673',
    iataNumber: '02170722',
  });
  assert.equal(poaBalcaoAttrs.prepaidAttrs, ' prepaidMode="NP"');
  assert.equal(poaBalcaoAttrs.iataAttr, ' IATANumber="02170722"');

  // 2. Reserva POA online/qualquer: prepaidMode="NP" (sempre destino) + IATANumber
  const poaOnlineAttrs = buildReservationPaymentAttrs({
    method: 'CREDIT',
    captured: true,
    amountBRL: 850.50,
    contractID: '57269673',
    iataNumber: '02170722',
  });
  assert.equal(poaOnlineAttrs.prepaidAttrs, ' prepaidMode="NP"');
  assert.equal(poaOnlineAttrs.iataAttr, ' IATANumber="02170722"');

  // 3. Reserva ETO corporativa NUNCA envia IATANumber
  const etoAttrs = buildReservationPaymentAttrs({
    method: 'CREDIT',
    captured: true,
    amountBRL: 850.50,
    contractID: '56935466',
    iataNumber: '02170722',
  });
  assert.equal(etoAttrs.iataAttr, '');
  assert.equal(etoAttrs.prepaidAttrs, '');
});

test('Responsividade e integridade do HTML dos e-mails — sem tags órfãs e tabelas sempre balanceadas', () => {
  // 1. Simula template com detalhamento legado contendo tabela aninhada e tag {{#TEXTO_DIARIAS}}
  const legacyHtml = `
<table class="main-table">
  <tr><td class="hdr-pad">Header</td></tr>
  <tr><td class="px"><p>Detalhamento da reserva</p>
    <table>
      <tr><td>Diárias</td><td>R$ 200</td></tr>
      {{#TEXTO_DIARIAS}}<tr><td>3 diárias</td></tr>{{/TEXTO_DIARIAS}}
    </table>
  </td></tr>
  <tr><td class="px"><p>Resumo de preço</p><table><tr><td>Total</td></tr></table></td></tr>
</table>
`;

  // Simula o enriquecimento / upgrade de template e sanitização
  let upgraded = legacyHtml.replace(/(?:<!--\s*DETALHAMENTO DA RESERVA\s*-->\s*)?<tr>\s*<td[^>]*class="px"[^>]*>\s*<p[^>]*>\s*Detalhamento da reserva\s*<\/p>[\s\S]*?<\/table>\s*<\/td>\s*<\/tr>/gi, '');
  upgraded = upgraded.replace(/\{\{\/?#?TEXTO_DIARIAS\}\}/gi, '');
  upgraded = upgraded.replace(/\{\{\/?#?[A-Za-z0-9_]+\}\}/g, '');

  assert.ok(!upgraded.includes('TEXTO_DIARIAS'), 'Nenhuma tag TEXTO_DIARIAS deve sobrar');
  assert.ok(!upgraded.includes('{{/'), 'Nenhuma tag de fechamento órfã deve existir');

  const openTables = (upgraded.match(/<table/g) || []).length;
  const closeTables = (upgraded.match(/<\/table>/g) || []).length;
  assert.equal(openTables, closeTables, 'Tabelas devem estar perfeitamente balanceadas');

  // 2. Correção de digitação no assunto "Sua foi reserva" -> "Sua reserva foi"
  const typoSubject = 'Enc.: Europcar - Sua foi reserva confirmada';
  const fixedSubject = typoSubject.replace(/Sua\s+foi\s+reserva/gi, 'Sua reserva foi');
  assert.equal(fixedSubject, 'Enc.: Europcar - Sua reserva foi confirmada');
});


test('Comissão do vendedor — % sobre a venda, valor fixo e regra zerada', () => {
  assert.equal(calcCommission('PERCENTAGE', 5, 1000), 50);
  assert.equal(calcCommission('PERCENTAGE', 7.5, 488.9), 36.67);
  assert.equal(calcCommission('FIXED', 40, 1000), 40);
  assert.equal(calcCommission('PERCENTAGE', 0, 1000), 0);
  assert.equal(calcCommission(null, null, 1000), 0);
  assert.equal(calcCommission(undefined, 10, 200), 20); // sem tipo = percentual
});

test('perfis: VENDEDOR só comissão, VENDEDOR_ADMIN tudo + comissão, ADMIN sem comissão, USER nada', () => {
  assert.equal(isAdminRole('VENDEDOR_ADMIN'), true);
  assert.equal(isSellerRole('VENDEDOR_ADMIN'), true);
  assert.equal(isAdminRole('VENDEDOR'), false);
  assert.equal(isSellerOnlyRole('VENDEDOR'), true);
  assert.equal(isSellerRole('ADMIN'), false);
  assert.equal(isAdminRole('USER'), false);
  assert.equal(isSellerRole('USER'), false);
  assert.equal(normalizeUserRole('hacker'), 'USER');
  assert.equal(normalizeUserRole('vendedor_admin'), 'VENDEDOR_ADMIN');
});
