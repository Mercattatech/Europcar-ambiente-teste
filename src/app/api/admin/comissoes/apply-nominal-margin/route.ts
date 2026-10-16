import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { buildNominalMarginSnapshot, isEtoContract, readEtoMarkupPercent, resolvePricingSnapshot } from '@/lib/commissions/pricingSnapshot';

export const dynamic = 'force-dynamic';

function parse(cd: any): any {
  try { return typeof cd === 'string' ? JSON.parse(cd) : (cd || {}); } catch { return {}; }
}

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const configuredMargin = await readEtoMarkupPercent();
    const marginPercent = Number(body?.marginPercent) > 0 ? Number(body?.marginPercent) : (configuredMargin > 0 ? configuredMargin : 25);
    const applyAllSemNet = !!body?.applyAllSemNet;
    const resNumber = body?.resNumber ? String(body.resNumber).trim() : null;

    if (!applyAllSemNet && !resNumber) {
      return NextResponse.json({ error: 'resNumber ou applyAllSemNet é obrigatório' }, { status: 400 });
    }

    if (resNumber) {
      const res = await prisma.localReservation.findFirst({
        where: { resNumber },
        select: { id: true, resNumber: true, amountInCents: true, customerData: true, status: true },
      });

      if (!res) {
        return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
      }

      const cd = parse(res.customerData);
      const built = buildNominalMarginSnapshot(cd, res.amountInCents, marginPercent);
      if ('error' in built) {
        return NextResponse.json({ error: built.error }, { status: 400 });
      }

      if (cd.pricingSnapshot) {
        cd.pricingSnapshotAnterior = cd.pricingSnapshot;
      }
      cd.pricingSnapshot = built.snapshot;
      delete cd.pricingBackfill;

      await prisma.localReservation.update({
        where: { id: res.id },
        data: { customerData: JSON.stringify(cd) },
      });

      return NextResponse.json({
        ok: true,
        resNumber: res.resNumber,
        snapshot: built.snapshot,
        message: `Margem nominal de ${marginPercent}% aplicada com sucesso à reserva ${resNumber}`,
      });
    }

    // Aplicar a todas as reservas ETO sem NET real
    const rows = await prisma.localReservation.findMany({
      where: { status: { not: 'CANCELLED' }, resNumber: { not: null } },
      select: { id: true, resNumber: true, amountInCents: true, customerData: true, status: true },
    });

    let updatedCount = 0;
    const updatedResNumbers: string[] = [];

    for (const r of rows) {
      const cd = parse(r.customerData);
      const isEto = isEtoContract(cd.booking?.contractID);
      const snap = resolvePricingSnapshot(cd, r.amountInCents);
      const hasError = !!cd.pricingBackfill?.error;
      const semNet = !snap && isEto;

      if (semNet || hasError) {
        const built = buildNominalMarginSnapshot(cd, r.amountInCents, marginPercent);
        if (!('error' in built)) {
          if (cd.pricingSnapshot) {
            cd.pricingSnapshotAnterior = cd.pricingSnapshot;
          }
          cd.pricingSnapshot = built.snapshot;
          delete cd.pricingBackfill;

          await prisma.localReservation.update({
            where: { id: r.id },
            data: { customerData: JSON.stringify(cd) },
          });

          updatedCount++;
          if (r.resNumber) updatedResNumbers.push(r.resNumber);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      updatedCount,
      updatedResNumbers,
      marginPercent,
      message: `Margem nominal de ${marginPercent}% aplicada a ${updatedCount} reserva(s) sem NET real`,
    });

  } catch (error: any) {
    console.error('[apply-nominal-margin] Error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao aplicar margem nominal' }, { status: 500 });
  }
}
