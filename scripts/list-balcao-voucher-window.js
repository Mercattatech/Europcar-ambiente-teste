/**
 * Lista reservas de BALCÃO (POA) criadas na janela em que o código chamava
 * createVoucher EXO para reservas POA/balcão (commit 7a35d0e, 26/10 17:45 BRT)
 * até a correção (commit 6bd46cf, 30/10 15:18 BRT). Essas reservas podem ter
 * ficado como "voucher" no GreenWay e precisam ser ajustadas pela Europcar.
 *
 * Uso (somente leitura):
 *   node scripts/list-balcao-voucher-window.js
 *   node scripts/list-balcao-voucher-window.js 2026-10-26T20:45:00Z 2026-10-30T18:18:00Z
 *
 * Requer DATABASE_URL no .env. Gera também reservas-balcao-janela-voucher.csv.
 */
require('dotenv').config();
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 26/10 17:45 -03:00  →  30/10 15:18 -03:00 (ajuste o fim se o deploy foi depois do commit)
const FROM = new Date(process.argv[2] || '2026-10-26T20:45:00Z');
const TO = new Date(process.argv[3] || '2026-10-30T18:18:00Z');

function parse(json) {
  if (!json) return {};
  if (typeof json === 'string') { try { return JSON.parse(json); } catch { return {}; } }
  return json;
}

async function main() {
  const rows = await prisma.localReservation.findMany({
    where: { createdAt: { gte: FROM, lte: TO } },
    orderBy: { createdAt: 'asc' },
  });

  const matches = rows
    .map((r) => {
      const d = parse(r.customerData);
      const booking = d.booking || {};
      const method = String(d.paymentMethod || '').toUpperCase();
      const isBalcao = method === 'BALCAO' || r.status === 'CONFIRMED_NON_PREPAID';
      return {
        resNumber: r.resNumber || '',
        criadaEm: r.createdAt.toISOString(),
        status: r.status,
        metodo: method || '-',
        contractID: booking.contractID || '',
        tariffType: booking.tariffType || '',
        cliente: `${d.nome || ''} ${d.sobrenome || ''}`.trim(),
        email: d.email || '',
        retirada: booking.pickupDate || '',
        isBalcao,
      };
    })
    .filter((r) => r.isBalcao && r.status !== 'CANCELLED' && /^\d{7,}$/.test(r.resNumber));

  console.log(`Janela: ${FROM.toISOString()} → ${TO.toISOString()}`);
  console.log(`Reservas de balcão (não canceladas) com nº GW: ${matches.length}\n`);
  console.table(matches.map(({ isBalcao, ...rest }) => rest));

  const header = ['resNumber', 'criadaEm', 'status', 'metodo', 'contractID', 'tariffType', 'cliente', 'email', 'retirada'];
  const csv = [header.join(';')]
    .concat(matches.map((m) => header.map((h) => String(m[h] ?? '').replace(/;/g, ',')).join(';')))
    .join('\n');
  fs.writeFileSync('reservas-balcao-janela-voucher.csv', csv, 'utf8');
  console.log('\nCSV salvo em reservas-balcao-janela-voucher.csv');
}

main().catch(console.error).finally(() => prisma.$disconnect());
