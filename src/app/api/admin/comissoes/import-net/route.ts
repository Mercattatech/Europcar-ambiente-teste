import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { buildManualSnapshot } from '@/lib/commissions/pricingSnapshot';

export const dynamic = 'force-dynamic';

/**
 * Importação do NET OFICIAL informado pela Europcar (extrato/fatura), por número de reserva.
 *
 * POST { rows: [{ resNumber, netBRL }], commit?: boolean, overwrite?: boolean }
 * - commit=false (padrão): só pré-visualiza (nada é gravado).
 * - commit=true: grava em customerData.pricingSnapshot (source EUROPCAR_EXTRATO).
 * - overwrite=false (padrão): não substitui NET que já veio da API (venda ou reconsulta no XRS).
 * O snapshot anterior é guardado em customerData.pricingSnapshotAnterior para auditoria.
 */

function parse(cd: any): any {
   try { return typeof cd === 'string' ? JSON.parse(cd) : (cd || {}); } catch { return {}; }
}

// Mesma classificação do relatório (/api/admin/comissoes)
function tipoPagamento(status: string, cd: any): string {
   const pm = cd?.paymentMethod || (cd?.cieloPaymentId && status === 'PENDING_PIX' ? 'PIX' : null);
   if (pm === 'PIX' || status === 'PENDING_PIX') return status === 'PENDING_PIX' ? 'PIX_PENDING' : 'PIX';
   if (pm === 'CREDIT' || (status === 'CONFIRMED_PREPAID' && pm !== 'PIX')) return 'CREDIT_CARD';
   return 'BALCAO';
}

export async function POST(request: Request) {
   if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

   try {
      const body = await request.json().catch(() => ({}));
      const commit = !!body?.commit;
      const overwrite = !!body?.overwrite;
      const input: { resNumber: string; netBRL: number }[] = Array.isArray(body?.rows) ? body.rows : [];
      if (input.length === 0) return NextResponse.json({ error: 'Nenhuma linha recebida' }, { status: 400 });
      if (input.length > 2000) return NextResponse.json({ error: 'Máximo de 2000 linhas por importação' }, { status: 400 });

      const rateCfg = await prisma.contentBlock.findUnique({ where: { key: 'COMMISSION_RATE' } });
      const rate = rateCfg?.value_ptBR ? parseFloat(rateCfg.value_ptBR) || 0 : 0;

      const resNumbers = Array.from(new Set(input.map(r => String(r.resNumber || '').trim()).filter(Boolean)));
      const reservations = await prisma.localReservation.findMany({
         where: { resNumber: { in: resNumbers } },
         select: { id: true, resNumber: true, status: true, amountInCents: true, customerData: true },
      });
      const byRes = new Map(reservations.map(r => [String(r.resNumber), r]));

      const seen = new Set<string>();
      const results: any[] = [];

      for (const row of input) {
         const resNumber = String(row.resNumber || '').trim();
         const netBRL = Number(row.netBRL);
         const base: any = { resNumber, netBRL };

         if (!resNumber) { results.push({ ...base, status: 'ERRO', detail: 'Linha sem número de reserva' }); continue; }
         if (seen.has(resNumber)) { results.push({ ...base, status: 'ERRO', detail: 'Reserva repetida na lista' }); continue; }
         seen.add(resNumber);

         const res = byRes.get(resNumber);
         if (!res) { results.push({ ...base, status: 'ERRO', detail: 'Reserva não encontrada no site' }); continue; }
         if (res.status === 'CANCELLED') { results.push({ ...base, status: 'IGNORADA', detail: 'Reserva cancelada' }); continue; }

         const cd = parse(res.customerData);
         const tipo = tipoPagamento(res.status, cd);
         const atual = cd.pricingSnapshot?.netBRL > 0 ? cd.pricingSnapshot : null;

         const built = buildManualSnapshot(cd, res.amountInCents, netBRL);
         if ('error' in built) { results.push({ ...base, tipo, status: 'ERRO', detail: built.error }); continue; }

         const geraComissao = tipo === 'CREDIT_CARD' || tipo === 'PIX';
         const info = {
            ...base,
            tipo,
            cobradoBRL: built.grossBRL,
            markupBRL: built.snapshot.markupBRL,
            markupPercent: built.snapshot.markupPercent,
            comissaoBRL: geraComissao ? Math.round(built.snapshot.markupBRL * rate) / 100 : 0,
            netAtual: atual ? Number(atual.netBRL) : null,
            origemAtual: atual ? (atual.source || 'XRS_QUOTE') : null,
            warnings: built.warnings,
         };

         const vindoDaApi = atual && atual.source !== 'EUROPCAR_EXTRATO';
         if (vindoDaApi && !overwrite) {
            results.push({ ...info, status: 'MANTIDA', detail: 'Já tem NET da API — marque "substituir" para usar o da Europcar' });
            continue;
         }

         if (commit) {
            if (atual) cd.pricingSnapshotAnterior = atual;
            cd.pricingSnapshot = built.snapshot;
            delete cd.pricingBackfill;
            await prisma.localReservation.update({ where: { id: res.id }, data: { customerData: JSON.stringify(cd) } });
         }
         results.push({ ...info, status: commit ? 'GRAVADA' : 'OK' });
      }

      const ok = results.filter(r => r.status === 'OK' || r.status === 'GRAVADA');
      return NextResponse.json({
         commit,
         rate,
         total: results.length,
         prontas: ok.length,
         comissaoTotal: Math.round(ok.reduce((s, r) => s + (r.comissaoBRL || 0), 0) * 100) / 100,
         results,
      });
   } catch (e: any) {
      console.error('Import NET error:', e);
      return NextResponse.json({ error: 'Erro ao importar NET' }, { status: 500 });
   }
}
