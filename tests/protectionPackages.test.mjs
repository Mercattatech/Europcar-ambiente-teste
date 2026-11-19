/**
 * Testes do agrupamento das proteções XRS em pacotes (Básica / Conforto / Premium).
 * Usa XML REAL da XRS (Lisboa LIST01, categoria EDMR).
 *
 * Rodar:  npm run test:packages
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseStringPromise } from 'xml2js';
import {
  buildProtectionPackages,
  basicRows,
  packageMemberCodes,
  sanitizeMatrix,
  DEFAULT_PACKAGE_MATRIX,
} from '../src/lib/europcar/protectionPackages.ts';

const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// Mesma conversão que a tela faz (page.tsx → parse do insuranceList)
function rowsFromInsuranceNodes(nodes) {
  return nodes.map((n) => {
    const a = n.$ || n;
    return {
      code: String(a.code || '').toUpperCase(),
      rawDescr: a.descr || '',
      type: a.type || 'O',
      fromInsuranceList: true,
      price: parseFloat(a.price || '0'),
      rentalPriceAI: parseFloat(a.rentalPriceAI || '0'),
      rentalPriceInBookingCurrencyAI: parseFloat(a.rentalPriceInBookingCurrencyAI || '0'),
      excessWithPOM: parseFloat(a.excessWithPOM || '0'),
      bkExcessWithPOM: parseFloat(a.bkExcessWithPOM || '0'),
    };
  });
}

async function quoteRows() {
  const xml = fs.readFileSync(new URL('./fixtures/xrs-getQuote-POA-LIST01-EDMR.xml', import.meta.url), 'utf8');
  const p = await parseStringPromise(xml, { explicitArray: false });
  const q = p.message.serviceResponse.reservation.quote;
  return rowsFromInsuranceNodes(arr(q.insuranceList.insurance));
}

test('Lisboa/POA: Básica = só o que a XRS marca como incluso (LDW), sem LAF (taxa)', async () => {
  const pk = buildProtectionPackages(await quoteRows());
  assert.deepEqual(pk.basic.items.map((i) => i.code), ['LDW']);
  assert.equal(pk.basic.items[0].label, 'BASIC(LDW)  Includes Theft And Collision Damage Waiver');
  assert.equal(pk.basic.priceBRL, 0);
  assert.equal(pk.basic.excessLocal, 2300);
  assert.equal(pk.basic.excessBRL, 14828.76);
});

test('Lisboa/POA: Conforto = pacote MEDIUM da XRS (nome, franquia e preço do XML)', async () => {
  const pk = buildProtectionPackages(await quoteRows());
  assert.deepEqual(pk.medium.members.map((m) => m.code), ['MEDIUM']);
  assert.equal(pk.medium.items[0].label, 'Medium Protection Package');
  assert.equal(pk.medium.excessLocal, 600);
  assert.equal(pk.medium.excessBRL, 3868.37);
  assert.equal(pk.medium.priceBRL, 172.27);
});

test('Lisboa/POA: Premium = pacote PREMIUM da XRS, franquia zero', async () => {
  const pk = buildProtectionPackages(await quoteRows());
  assert.deepEqual(pk.premium.members.map((m) => m.code), ['PREMIUM']);
  assert.equal(pk.premium.items[0].label, 'Premium Protection package more 19 Years old');
  assert.equal(pk.premium.excessLocal, 0);
  assert.equal(pk.premium.priceBRL, 229.65);
});

test('PREMPLUS e coberturas avulsas não viram pacote (ficam como avulsas)', async () => {
  const pk = buildProtectionPackages(await quoteRows());
  const used = packageMemberCodes(pk);
  assert.ok(used.has('MEDIUM') && used.has('PREMIUM'));
  assert.ok(!used.has('PREMPLUS') && !used.has('WWI'));
});

test('Itens de chargeList (taxas, type M fora do insuranceList) nunca entram na Básica', () => {
  const rows = [
    { code: 'LDW', type: 'I', fromInsuranceList: true, excessWithPOM: 100, bkExcessWithPOM: 600 },
    { code: 'VAT', type: 'M', fromInsuranceList: false },
    { code: 'AIRPORTFEE', type: 'M', fromInsuranceList: false },
  ];
  assert.deepEqual(basicRows(rows).map((r) => r.code), ['LDW']);
});

test('Estação sem MEDIUM/PREMIUM: o card some (nada inventado)', () => {
  const rows = [
    { code: 'LDW', type: 'I', fromInsuranceList: true, rawDescr: 'BASIC', excessWithPOM: 500, bkExcessWithPOM: 3000 },
    { code: 'RSA', type: 'O', fromInsuranceList: true, rentalPriceInBookingCurrencyAI: 50 },
  ];
  const pk = buildProtectionPackages(rows);
  assert.ok(pk.basic);
  assert.equal(pk.medium, null);
  assert.equal(pk.premium, null);
});

test('Combo alternativo (SCDW+WWI+PAI) só vale se TODOS os códigos existirem na resposta', () => {
  const mk = (code, p) => ({ code, type: 'O', fromInsuranceList: true, rentalPriceInBookingCurrencyAI: p, bkExcessWithPOM: code === 'SCDW' ? 1500 : 0, excessWithPOM: 0 });
  const ok = buildProtectionPackages([mk('SCDW', 150), mk('WWI', 50), mk('PAI', 40)]);
  assert.deepEqual(ok.medium.members.map((m) => m.code), ['SCDW', 'WWI', 'PAI']);
  assert.equal(ok.medium.priceBRL, 240);
  assert.equal(ok.medium.excessBRL, 1500);
  const faltando = buildProtectionPackages([mk('SCDW', 150), mk('WWI', 50)]);
  assert.equal(faltando.medium, null);
});

test('Matriz configurada no painel é respeitada; entrada inválida cai no padrão', async () => {
  const m = sanitizeMatrix({ medium: [['wwi']], premium: 'x', basicExclude: [] });
  assert.deepEqual(m.medium, [['WWI']]);
  assert.deepEqual(m.premium, DEFAULT_PACKAGE_MATRIX.premium);
  const pk = buildProtectionPackages(await quoteRows(), m);
  assert.deepEqual(pk.medium.members.map((x) => x.code), ['WWI']);
  assert.deepEqual(pk.basic.items.map((i) => i.code), ['LDW', 'LAF']); // basicExclude vazio → LAF volta
});

test('Contrato Franquia Zero ETO (XML real): itens embutidos type=M vêm do XML', async () => {
  const xml = fs.readFileSync(new URL('./fixtures/xrs-getMultipleRates-ETOZERO-LIST01-EDMR-insurances.xml', import.meta.url), 'utf8');
  const p = await parseStringPromise(xml, { explicitArray: false });
  const nodes = arr(p.message.serviceResponse.reservationRateList.reservationRate.insuranceList.insurance);
  const rows = rowsFromInsuranceNodes(nodes);
  const embedded = rows.filter((r) => r.type === 'M').map((r) => r.code).sort();
  assert.deepEqual(embedded, ['SPCDW', 'SPTHW', 'WWI']);
  assert.ok(rows.filter((r) => r.type === 'M').every((r) => r.excessWithPOM === 0));
});
