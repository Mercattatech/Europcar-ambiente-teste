/**
 * Diagnóstico (SOMENTE LEITURA) dos templates de e-mail salvos no banco.
 *
 * Mostra, para cada trigger de reserva, qual template está vinculado e se ele contém
 * os placeholders de proteções/franquias e acessórios.
 *
 * Uso (com o DATABASE_URL real de produção no ambiente):
 *   DATABASE_URL="postgresql://..." node scripts/check-email-templates.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RESERVATION_TRIGGERS = ['RESERVA_SUCESSO', 'RESERVA_SOB_SOLICITACAO', 'RESERVA_CONFIRMADA', 'RESERVA_ALTERADA'];
const REQUIRED = ['LISTA_PROTECOES', 'LISTA_EXTRAS'];

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '_');

(async () => {
  const get = async (key) => (await prisma.contentBlock.findUnique({ where: { key } }))?.value_ptBR;
  const templates = JSON.parse((await get('EMAIL_TEMPLATES')) || '[]');
  const triggers = JSON.parse((await get('EMAIL_TRIGGERS')) || '{}');

  for (const trigger of RESERVATION_TRIGGERS) {
    const id = triggers[trigger];
    const tpl = templates.find((t) => t.id === id);
    if (!id || !tpl) {
      console.log(`⚠️  ${trigger}: sem template vinculado (usa o fallback hardcoded)`);
      continue;
    }
    const vars = new Set((tpl.html.match(/\{\{([^}]+)\}\}/g) || []).map((v) => norm(v.slice(2, -2))));
    const missing = REQUIRED.filter((r) => !vars.has(r));
    console.log(
      `${missing.length ? '❌' : '✅'} ${trigger} → "${tpl.name || tpl.id}"` +
        (missing.length ? `  FALTAM: ${missing.map((m) => `{{${m}}}`).join(', ')}` : '  ok'),
    );
  }
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
