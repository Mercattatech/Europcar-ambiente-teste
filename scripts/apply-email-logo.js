/**
 * Substitui o nome "Europcar" (texto estilizado no cabeçalho) pelo logotipo
 * https://europcar.com.br/logo-email.png em TODOS os templates de e-mail cadastrados no banco
 * (ContentBlock EMAIL_TEMPLATES — os mesmos editados em /painel/config-email).
 *
 * Só troca o "Europcar" usado como logotipo (elemento com font-style:italic contendo
 * apenas a palavra Europcar). Menções no texto do e-mail NÃO são alteradas.
 *
 * Uso (com o DATABASE_URL real de produção):
 *   DATABASE_URL="postgresql://..." node scripts/apply-email-logo.js          # só mostra o que mudaria
 *   DATABASE_URL="postgresql://..." node scripts/apply-email-logo.js --apply  # grava no banco
 *
 * Antes de gravar, salva um backup em ContentBlock EMAIL_TEMPLATES_BACKUP_<timestamp>.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const LOGO_URL = 'https://europcar.com.br/logo-email.png';
const IMG = (display) =>
  `<img src="${LOGO_URL}" width="150" height="35" alt="Europcar" style="display:${display};width:150px;height:35px;border:0;outline:none;text-decoration:none;">`;

// <td|div|span|p|h1-3 ... style="...font-style:italic..."> Europcar </tag>
const WORDMARK_RE = /<(td|div|span|p|h[1-3])(\s[^>]*?)?style="([^"]*font-style:\s*italic[^"]*)"([^>]*)>\s*(?:Europcar|EUROPCAR)\s*<\/\1>/g;

function replaceWordmark(html) {
  let count = 0;
  const out = html.replace(WORDMARK_RE, (_m, tag, pre = '', _style, post = '') => {
    count++;
    const isTd = tag === 'td';
    // Mantém atributos como align="left"; troca só o estilo de texto pelo contêiner da imagem
    return `<${tag}${pre || ''}style="line-height:0;font-size:0;"${post || ''}>${IMG(isTd ? 'block' : 'inline-block')}</${tag}>`;
  });
  return { out, count };
}

(async () => {
  const block = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TEMPLATES' } });
  if (!block?.value_ptBR) {
    console.log('Nenhum template cadastrado em EMAIL_TEMPLATES.');
    return;
  }
  const templates = JSON.parse(block.value_ptBR);
  let total = 0;

  for (const tpl of templates) {
    if (typeof tpl.html !== 'string') continue;
    // Migra a 1ª versão (logo.jpg com caixa verde-limão, 130x45) para o PNG transparente
    const OLD_IMG_RE = /<img src="https:\/\/europcar\.com\.br\/logo\.jpg"[^>]*>/g;
    if (OLD_IMG_RE.test(tpl.html)) {
      const n = (tpl.html.match(OLD_IMG_RE) || []).length;
      tpl.html = tpl.html.replace(OLD_IMG_RE, IMG('block'));
      total += n;
      console.log(`✔  "${tpl.name || tpl.id}": logo.jpg antigo → PNG transparente (${n})`);
      continue;
    }
    if (tpl.html.includes(LOGO_URL)) {
      console.log(`=  "${tpl.name || tpl.id}": já tem o logotipo`);
      continue;
    }
    const { out, count } = replaceWordmark(tpl.html);
    if (count > 0) {
      tpl.html = out;
      total += count;
      console.log(`✔  "${tpl.name || tpl.id}": ${count} substituição(ões)`);
    } else {
      console.log(`⚠️  "${tpl.name || tpl.id}": cabeçalho "Europcar" não encontrado — revisar manualmente no painel`);
    }
  }

  if (!APPLY) {
    console.log(`\nPrévia: ${total} substituição(ões). Nada foi gravado. Rode com --apply para salvar.`);
    return;
  }
  if (total === 0) {
    console.log('\nNada para gravar.');
    return;
  }

  const backupKey = `EMAIL_TEMPLATES_BACKUP_${Date.now()}`;
  await prisma.contentBlock.create({ data: { key: backupKey, value_ptBR: block.value_ptBR } });
  await prisma.contentBlock.update({
    where: { key: 'EMAIL_TEMPLATES' },
    data: { value_ptBR: JSON.stringify(templates) },
  });
  console.log(`\n✅ Gravado. ${total} substituição(ões). Backup salvo em ContentBlock "${backupKey}".`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
