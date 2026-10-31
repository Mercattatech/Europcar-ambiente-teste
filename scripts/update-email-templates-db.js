/**
 * Script para sincronizar os templates responsivos de docs/email-templates/ para o banco de dados (EMAIL_TEMPLATES).
 *
 * Cria automaticamente um backup do estado anterior em ContentBlock com a chave EMAIL_TEMPLATES_BACKUP_<timestamp>.
 *
 * Como rodar:
 *   node scripts/update-email-templates-db.js
 *   (Lê automaticamente DATABASE_URL de .env.local ou .env)
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carrega .env.local primeiro, depois .env
const envLocal = path.resolve(__dirname, '../.env.local');
const env = path.resolve(__dirname, '../.env');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
else if (fs.existsSync(env)) dotenv.config({ path: env });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATE_FILES = {
  RESERVA_SUCESSO: path.resolve(__dirname, '../docs/email-templates/RESERVA_SUCESSO.html'),
  RESERVA_CONFIRMADA: path.resolve(__dirname, '../docs/email-templates/RESERVA_CONFIRMADA.html'),
  RESERVA_SOB_SOLICITACAO: path.resolve(__dirname, '../docs/email-templates/RESERVA_SOB_SOLICITACAO.html'),
  RESERVA_ALTERADA: path.resolve(__dirname, '../docs/email-templates/RESERVA_ALTERADA.html'),
  CANCELAMENTO: path.resolve(__dirname, '../docs/email-templates/CANCELAMENTO.html'),
};

async function main() {
  console.log('🔄 Iniciando atualização dos templates de e-mail no banco...');

  const block = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TEMPLATES' } });
  if (!block || !block.value_ptBR) {
    console.log('⚠️ Nenhum bloco EMAIL_TEMPLATES encontrado no banco.');
    return;
  }

  let templates = [];
  try {
    templates = JSON.parse(block.value_ptBR);
  } catch (err) {
    console.error('❌ Erro ao parsear JSON de EMAIL_TEMPLATES:', err.message);
    return;
  }

  // Backup seguro
  const backupKey = `EMAIL_TEMPLATES_BACKUP_${Date.now()}`;
  await prisma.contentBlock.upsert({
    where: { key: backupKey },
    create: { key: backupKey, value_ptBR: block.value_ptBR },
    update: { value_ptBR: block.value_ptBR },
  });
  console.log(`💾 Backup salvo no banco com a chave: ${backupKey}`);

  // Triggers map
  const triggersBlock = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TRIGGERS' } });
  const triggers = triggersBlock?.value_ptBR ? JSON.parse(triggersBlock.value_ptBR) : {};

  let updatedCount = 0;

  for (const [key, filePath] of Object.entries(TEMPLATE_FILES)) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Arquivo não encontrado: ${filePath}`);
      continue;
    }

    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const targetId = triggers[key];

    // Procura por ID vinculado ao trigger ou por correspondência de nome / id
    let target = null;
    if (targetId) {
      target = templates.find((t) => t.id === targetId);
    }
    if (!target) {
      target = templates.find((t) => 
        (t.id && t.id.toUpperCase().includes(key)) || 
        (t.name && t.name.toUpperCase().includes(key))
      );
    }

    if (target) {
      target.html = htmlContent;
      target.updatedAt = new Date().toISOString();
      console.log(`✅ Template atualizado para [${key}]: ${target.name || target.id}`);
      updatedCount++;
    } else {
      console.log(`ℹ️ Template com ID "${targetId || key}" não encontrado no array. Adicionando novo...`);
      const newId = targetId || `tpl_${key.toLowerCase()}`;
      templates.push({
        id: newId,
        name: key.replace(/_/g, ' '),
        html: htmlContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!triggers[key]) {
        triggers[key] = newId;
      }
      updatedCount++;
    }
  }

  // Salva no banco
  await prisma.contentBlock.update({
    where: { key: 'EMAIL_TEMPLATES' },
    data: { value_ptBR: JSON.stringify(templates) },
  });

  if (triggersBlock) {
    await prisma.contentBlock.update({
      where: { key: 'EMAIL_TRIGGERS' },
      data: { value_ptBR: JSON.stringify(triggers) },
    });
  }

  console.log(`🎉 Sucesso! ${updatedCount} templates atualizados no banco de dados com layout 100% responsivo.`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
