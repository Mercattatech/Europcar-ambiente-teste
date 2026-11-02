/**
 * Testes da regra de preço ETO (cartão) × POA (balcão).
 *
 * Rodar:  node --no-warnings --test tests/etoPricing.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEtoPricing, normalizeMinDiscountPercent } from '../src/lib/pricing/etoPricing.ts';

test('markup do painel respeitado quando já há desconto >= mínimo', () => {
  // NET 150 + 10% = 165 ; POA 200 → 17,5% de desconto
  const r = computeEtoPricing({ etoNet: 150, poaTotal: 200, markupPercent: 10, minDiscountPercent: 6 });
  assert.equal(r.capped, false);
  assert.equal(r.metMinDiscount, true);
  assert.ok(Math.abs(r.price - 165) < 1e-9);
  assert.ok(Math.abs(r.effectiveMarkupPercent - 10) < 1e-6);
});

test('markup é reduzido para garantir o desconto mínimo sobre o POA (caso do site: 4% → 6%)', () => {
  // POA 202,88 ; NET 170 ; markup 14,9% → 195,33 (3,7%) → deve cair para <= 190,71 (6%)
  const r = computeEtoPricing({ etoNet: 170, poaTotal: 202.88, markupPercent: 14.9, minDiscountPercent: 6 });
  assert.equal(r.capped, true);
  assert.equal(r.metMinDiscount, true);
  assert.ok(r.price <= 202.88 * 0.94 + 1e-9);
  assert.ok(r.discountPercent >= 6 - 1e-9);
  assert.ok(r.effectiveMarkupPercent > 0 && r.effectiveMarkupPercent < 14.9);
});

test('nunca vende abaixo do NET: sem como atingir o mínimo, vende no NET e sinaliza', () => {
  // NET 195 ; POA 200 → 6% exigiria 188 (< NET) → vende no NET (2,5%)
  const r = computeEtoPricing({ etoNet: 195, poaTotal: 200, markupPercent: 8, minDiscountPercent: 6 });
  assert.equal(r.capped, true);
  assert.equal(r.metMinDiscount, false);
  assert.ok(Math.abs(r.price - 195) < 1e-9);
  assert.ok(Math.abs(r.effectiveMarkupPercent) < 1e-6);
});

test('desconto mínimo 0 desativa a regra', () => {
  const r = computeEtoPricing({ etoNet: 195, poaTotal: 200, markupPercent: 8, minDiscountPercent: 0 });
  assert.equal(r.capped, false);
  assert.ok(Math.abs(r.price - 195 * 1.08) < 1e-9);
});

test('sem POA para comparar, mantém o markup do painel', () => {
  const r = computeEtoPricing({ etoNet: 100, poaTotal: 0, markupPercent: 12, minDiscountPercent: 6 });
  assert.equal(r.capped, false);
  assert.equal(r.metMinDiscount, true);
  assert.ok(Math.abs(r.price - 112) < 1e-9);
});

test('normalizeMinDiscountPercent: padrão 6%, limita a 95%', () => {
  assert.equal(normalizeMinDiscountPercent(undefined), 6);
  assert.equal(normalizeMinDiscountPercent(''), 6);
  assert.equal(normalizeMinDiscountPercent('abc'), 6);
  assert.equal(normalizeMinDiscountPercent('0'), 0);
  assert.equal(normalizeMinDiscountPercent('7,5'), 7.5);
  assert.equal(normalizeMinDiscountPercent(200), 95);
});
