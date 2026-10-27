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

test('1208543518 — markup (margem ETO) só no bloco on-line, linhas somam o subtotal', async () => {
  const split = computePaymentSplit(await reservationOf(XML_1208543518), { onlineMarkupPercent: 10, logger: null });
  assert.equal(split.online.netSubtotalBRL, 1391.92);
  assert.equal(split.online.subtotalBRL, 1531.11); // 1391,92 × 1,10
  const linesSum = Math.round(split.online.lines.reduce((s, l) => s + l.priceBRL, 0) * 100) / 100;
  assert.equal(linesSum, split.online.subtotalBRL);
  assert.equal(split.counter.subtotalBRL, 70.91); // balcão nunca recebe markup
  assert.equal(split.totalBRL, 1602.02);
  assert.equal(split.netTotalBRL, 1462.83);
  assert.equal(split.totalMatches, true);
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
