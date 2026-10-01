import {
  normalizeBrand,
  normalizeReturnCode,
  expandAliases,
  detectLinxAntifraud,
  sanitizePaymentPayload,
  normalizeAmount,
  matchDictionaryCode,
  registerFailedTransaction,
  buildIdempotencyKey
} from '../src/lib/rejectionService';
import { BASE_REJECTION_DICTIONARY } from '../src/lib/rejectionDictionaryData';
import prisma from '../src/lib/prisma';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO BATERIA DE TESTES MASTER PROMPT V4');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Um código simples por bandeira
  const elo04 = await matchDictionaryCode({ brand: 'Elo', codeNormalized: '04', rawCode: '04', technicalMessage: '' });
  assert(elo04.mappingStatus === 'MAPPED' && elo04.entry?.cardBrand === 'Elo' && elo04.entry?.rejectionType === 'REVERSÍVEL', '1.1 Elo código 04');

  const visa51 = await matchDictionaryCode({ brand: 'Visa', codeNormalized: '51', rawCode: '51', technicalMessage: '' });
  assert(visa51.mappingStatus === 'MAPPED' && visa51.entry?.cardBrand === 'Visa' && visa51.entry?.rejectionCategory === 'INSUFFICIENT_FUNDS', '1.2 Visa código 51');

  const master43 = await matchDictionaryCode({ brand: 'Mastercard', codeNormalized: '43', rawCode: '43', technicalMessage: '' });
  assert(master43.mappingStatus === 'MAPPED' && master43.entry?.cardBrand === 'Mastercard' && master43.entry?.rejectionType === 'IRREVERSÍVEL', '1.3 Mastercard código 43');

  // 2. Mesmo código com significados diferentes desempata por mensagem
  const elo57Fraude = await matchDictionaryCode({
    brand: 'Elo',
    codeNormalized: '57',
    rawCode: '57',
    technicalMessage: 'FRAUDE CONFIRMADA'
  });
  assert(elo57Fraude.entry?.technicalMessage === 'FRAUDE CONFIRMADA' && elo57Fraude.entry?.rejectionCategory === 'FRAUD_SECURITY', '2.1 Elo 57 com mensagem de Fraude');

  const elo57Terminal = await matchDictionaryCode({
    brand: 'Elo',
    codeNormalized: '57',
    rawCode: '57',
    technicalMessage: 'CAPACIDADE DO TERMINAL'
  });
  assert(elo57Terminal.entry?.technicalMessage?.includes('TERMINAL') || false, '2.2 Elo 57 com mensagem de Terminal');

  // 3. Código composto / alias
  const visa52 = await matchDictionaryCode({ brand: 'Visa', codeNormalized: '52', rawCode: '52', technicalMessage: 'DÉBITO' });
  assert(visa52.mappingStatus === 'MAPPED' && (visa52.entry?.codeDisplay?.includes('52 ou 53') ?? false), '3.1 Visa alias 52 de "52 ou 53"');

  const master01 = await matchDictionaryCode({ brand: 'Mastercard', codeNormalized: '01', rawCode: '01', technicalMessage: '' });
  assert(master01.mappingStatus === 'MAPPED' && (master01.entry?.codeDisplay?.includes('14 ou 01') ?? false), '3.2 Master alias 01 de "14 ou 01"');

  // 4. Código com * documental
  const elo5C = await matchDictionaryCode({ brand: 'Elo', codeNormalized: '5C', rawCode: '5C', technicalMessage: '' });
  assert(elo5C.mappingStatus === 'MAPPED' && elo5C.entry?.codeDisplay === '5C*', '4.1 Elo código 5C* mapeado a partir de 5C');

  const master94 = await matchDictionaryCode({ brand: 'Mastercard', codeNormalized: '94', rawCode: '94', technicalMessage: '' });
  assert(master94.mappingStatus === 'MAPPED' && master94.entry?.codeDisplay === '94*', '4.2 Mastercard código 94* mapeado a partir de 94');

  // 5. Linx Rejected / Antifraude
  const linxDetect = detectLinxAntifraud({
    fraudAnalysis: { Status: 'Rejected' },
    returnMessage: 'Reprovado na análise de risco Lynx'
  });
  assert(linxDetect.isAntifraud, '5.1 Linx detectado por fraudAnalysis.Status = Rejected');

  const linxMatch = await matchDictionaryCode({
    provider: 'Cielo',
    brand: 'Visa',
    codeNormalized: '16',
    rawCode: '16',
    technicalMessage: 'AbortedByFraud',
    isAntifraud: true
  });
  assert(linxMatch.entry?.rejectionCategory === 'ANTIFRAUD_LINX', '5.2 Prioridade Linx ANTIFRAUD_LINX sobre códigos financeiros');

  // 6. XRS regras
  const xrsAge = await matchDictionaryCode({
    provider: 'Europcar XRS',
    codeNormalized: 'rental.drivertooyoungforcategory',
    rawCode: 'rental.drivertooyoungforcategory',
    technicalMessage: 'rental.drivertooyoungforcategory'
  });
  assert(xrsAge.entry?.rejectionCategory === 'XRS_RULES' && xrsAge.entry?.canRetry === false, '6.1 XRS Driver too young');

  // 7. Código desconhecido
  const unk = await matchDictionaryCode({
    provider: 'Cielo',
    brand: 'Visa',
    codeNormalized: 'CODIGO_INVENTADO_999',
    rawCode: 'CODIGO_INVENTADO_999',
    technicalMessage: 'Falha desconhecida do banco emissor'
  });
  assert(unk.mappingStatus === 'UNKNOWN' && unk.entry?.rejectionCategory === 'UNKNOWN_CODE', '7.1 Código desconhecido não é descartado');

  // 8 & 9. Idempotência e nova tentativa real
  const key1 = buildIdempotencyKey({
    merchantOrderId: 'ORDER_123',
    paymentId: 'PAY_ABC',
    attemptNumber: 1,
    codeNormalized: '51'
  });

  const keyDuplicate = buildIdempotencyKey({
    merchantOrderId: 'ORDER_123',
    paymentId: 'PAY_ABC',
    attemptNumber: 1,
    codeNormalized: '51'
  });
  assert(key1 === keyDuplicate, '8. Webhook duplicado gera a mesma chave de idempotência para evitar duplicidade');

  const keyNewAttempt = buildIdempotencyKey({
    merchantOrderId: 'ORDER_123',
    paymentId: 'PAY_DEF', // Nova tentativa com outro paymentId
    attemptNumber: 2,
    codeNormalized: '51'
  });
  assert(key1 !== keyNewAttempt, '9. Nova tentativa real do mesmo pedido gera chave distinta para registrar nova tentativa');

  // 10. Payload sem bandeira normalizado para Cielo/Geral
  assert(normalizeBrand(null) === 'Cielo/Geral' && normalizeBrand('') === 'Cielo/Geral', '10. Payload sem bandeira -> Cielo/Geral');

  // 11. Valor em centavos convertido para reais uma única vez
  const amt1 = normalizeAmount(25000, true);
  const amt2 = normalizeAmount(250.00, false);
  assert(amt1 === 250.00 && amt2 === 250.00, '11. Conversão monetária consistente de centavos e reais');

  // 12. Mascaramento de dados sensíveis
  const sanitized = sanitizePaymentPayload({
    CardNumber: '4012001037141112',
    SecurityCode: '123',
    Customer: { Name: 'João Silva' }
  });
  assert(
    sanitized.CardNumber.includes('******') && !sanitized.CardNumber.includes('3714') && sanitized.SecurityCode === '***',
    '12. Mascaramento de PAN e eliminação de CVV'
  );

  // 13. Código FG — AmEx/Emissor
  const fg = await matchDictionaryCode({
    provider: 'Cielo',
    brand: 'AmEx',
    codeNormalized: 'FG',
    rawCode: 'FG',
    technicalMessage: ''
  });
  assert(
    fg.entry?.rejectionCategory === 'ISSUER_DECLINED' &&
    fg.entry?.canRetry === false &&
    fg.entry?.responsibility?.includes('Portador') === true,
    '13. Código FG com responsabilidade do Portador e canRetry=false'
  );

  // 14. Código GA — Lynx Online / Antifraude
  const ga = await matchDictionaryCode({
    provider: 'Cielo',
    brand: 'Visa',
    codeNormalized: 'GA',
    rawCode: 'GA',
    technicalMessage: ''
  });
  assert(
    ga.entry?.rejectionCategory === 'ANTIFRAUD_LINX' &&
    ga.entry?.canRetry === false,
    '14. Código GA priorizado como ANTIFRAUD_LINX'
  );

  // 15. Códigos GF / GD — Configuração da loja
  const gf = await matchDictionaryCode({ codeNormalized: 'GF', rawCode: 'GF', technicalMessage: '' });
  const gd = await matchDictionaryCode({ codeNormalized: 'GD', rawCode: 'GD', technicalMessage: '' });
  assert(
    gf.entry?.rejectionCategory === 'MERCHANT_CONFIGURATION' &&
    gd.entry?.rejectionCategory === 'MERCHANT_CONFIGURATION' &&
    gf.entry?.responsibility?.includes('Estabelecimento') === true,
    '15. Códigos GF e GD classificados como MERCHANT_CONFIGURATION'
  );

  // 16. Códigos GT / GK — Ataque Força Bruta e Bloqueio
  const gt = await matchDictionaryCode({ codeNormalized: 'GT', rawCode: 'GT', technicalMessage: '' });
  const gk = await matchDictionaryCode({ codeNormalized: 'GK', rawCode: 'GK', technicalMessage: '' });
  assert(
    gt.entry?.rejectionCategory === 'SECURITY_BRUTE_FORCE' &&
    gk.entry?.rejectionCategory === 'SECURITY_BRUTE_FORCE' &&
    gt.entry?.canRetry === false,
    '16. Códigos GT e GK classificados como SECURITY_BRUTE_FORCE'
  );

  // Total do Dicionário
  assert(BASE_REJECTION_DICTIONARY.length === 142, `17. Dicionário contém exatamente 142 entradas oficiais (atual: ${BASE_REJECTION_DICTIONARY.length})`);

  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL: ${passed} PASSOU | ${failed} FALHOU`);
  console.log('====================================================');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
