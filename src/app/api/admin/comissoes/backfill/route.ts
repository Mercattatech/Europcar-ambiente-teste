import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { readBooking } from '@/lib/europcar/xrsClient';
import { buildBackfillSnapshot, isEtoContract } from '@/lib/commissions/pricingSnapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BATCH = 12; // consultas ao XRS por chamada (a tela repete até zerar)

function parse(cd: any): any {
   try { return typeof cd === 'string' ? JSON.parse(cd) : (cd || {}); } catch { return {}; }
}

/** Reservas ETO, não canceladas, sem snapshot gravado. `retry` inclui as que já falharam antes. */
async function loadCandidates(retry: boolean) {
   const rows = await prisma.localReservation.findMany({
      where: { status: { not: 'CANCELLED' }, resNumber: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, resNumber: true, amountInCents: true, customerData: true },
   });
   return rows.filter(r => {
      const cd = parse(r.customerData);
      if (cd.pricingSnapshot?.netBRL > 0) return false;
      if (!isEtoContract(cd.booking?.contractID)) return false;
      if (cd.pricingBackfill?.error) {
         const recent = Date.now() - new Date(cd.pricingBackfill.at || 0).getTime() < 5 * 60 * 1000;
         if (!retry || recent) return false; // retry só reprocessa falhas com mais de 5 min (evita repetir no mesmo ciclo)
      }
      return true;
   });
}

/** Quantas reservas ainda aguardam a reconsulta. */
export async function GET() {
   if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   try {
      const all = await loadCandidates(false);
      const retryable = (await loadCandidates(true)).length - all.length;
      return NextResponse.json({ pending: all.length, failedBefore: retryable });
   } catch (e: any) {
      console.error('Backfill GET error:', e);
      return NextResponse.json({ error: 'Erro ao contar pendências' }, { status: 500 });
   }
}

/** Processa um lote: consulta o XRS e grava NET/markup reais no customerData.pricingSnapshot. */
export async function POST(request: Request) {
   if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   try {
      let retry = false;
      try { retry = !!(await request.json())?.retry; } catch { /* corpo opcional */ }

      const candidates = await loadCandidates(retry);
      const batch = candidates.slice(0, BATCH);
      const results: { resNumber: string; ok: boolean; detail: string }[] = [];

      for (const r of batch) {
         const cd = parse(r.customerData);
         let outcome: { ok: boolean; detail: string };
         try {
            const xrs = await readBooking(r.resNumber as string);
            if (!xrs.found) {
               outcome = { ok: false, detail: xrs.error || 'Não encontrada no XRS' };
            } else {
               const snap = buildBackfillSnapshot(cd, r.amountInCents, xrs.quote);
               if ('error' in snap) {
                  outcome = { ok: false, detail: snap.error };
               } else {
                  cd.pricingSnapshot = snap;
                  delete cd.pricingBackfill;
                  await prisma.localReservation.update({ where: { id: r.id }, data: { customerData: JSON.stringify(cd) } });
                  outcome = { ok: true, detail: `NET R$ ${snap.netBRL.toFixed(2)} · markup ${snap.markupPercent}%` };
               }
            }
         } catch (e: any) {
            outcome = { ok: false, detail: e?.message || 'Falha ao consultar o XRS' };
         }

         if (!outcome.ok) {
            // Marca a falha para não repetir a consulta a cada lote (retry=true reprocessa)
            try {
               cd.pricingBackfill = { error: outcome.detail, at: new Date().toISOString() };
               await prisma.localReservation.update({ where: { id: r.id }, data: { customerData: JSON.stringify(cd) } });
            } catch { /* melhor esforço */ }
         }
         results.push({ resNumber: r.resNumber as string, ...outcome });
      }

      return NextResponse.json({
         processed: results.length,
         updated: results.filter(x => x.ok).length,
         failed: results.filter(x => !x.ok).length,
         remaining: Math.max(0, candidates.length - batch.length),
         results,
      });
   } catch (e: any) {
      console.error('Backfill POST error:', e);
      return NextResponse.json({ error: 'Erro ao reprocessar reservas' }, { status: 500 });
   }
}
