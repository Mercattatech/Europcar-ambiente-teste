import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getActor, NOT_SOLD_STATUSES } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

/**
 * Vendas dos vendedores (links usados + vendas diretas) com comissão.
 * Admin vê todos (filtro opcional sellerId); vendedor vê apenas as próprias.
 */
export async function GET(req: Request) {
  const actor = await getActor();
  if (!actor || !actor.id && actor.kind === 'VENDEDOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const where: any = { status: 'USED' };
  if (actor.kind === 'VENDEDOR') where.sellerId = actor.id;
  else if (sp.get('sellerId')) where.sellerId = sp.get('sellerId');
  if (sp.get('commissionStatus')) where.commissionStatus = sp.get('commissionStatus');
  const start = sp.get('startDate');
  const end = sp.get('endDate');
  if (start || end) {
    where.usedAt = {};
    if (start) where.usedAt.gte = new Date(start + 'T00:00:00');
    if (end) where.usedAt.lte = new Date(end + 'T23:59:59');
  }

  const links = await prisma.paymentLink.findMany({
    where,
    orderBy: { usedAt: 'desc' },
    take: 500,
    include: { seller: { select: { id: true, name: true, email: true } } },
  });

  const orderIds = links.map((l) => l.merchantOrderId).filter(Boolean) as string[];
  const reservations = orderIds.length
    ? await prisma.localReservation.findMany({
        where: { merchantOrderId: { in: orderIds } },
        select: { merchantOrderId: true, status: true, resNumber: true },
      })
    : [];
  const resByOrder = new Map(reservations.map((r) => [r.merchantOrderId, r]));

  const rows = links.map((l) => {
    const r = l.merchantOrderId ? resByOrder.get(l.merchantOrderId) : undefined;
    const reservationStatus = r?.status || null;
    // PIX pendente ou reserva cancelada não geram comissão devida
    const sold = !!r && !NOT_SOLD_STATUSES.includes(r.status);
    return {
      id: l.id,
      seller: l.seller,
      customerName: l.customerName,
      resNumber: r?.resNumber || l.resNumber,
      paymentMethod: l.paymentMethod,
      totalBRL: l.amountInCents / 100,
      usedAt: l.usedAt,
      reservationStatus,
      sold,
      commissionType: l.commissionType,
      commissionRate: l.commissionRate,
      commissionAmount: l.commissionAmount ?? 0,
      commissionStatus: l.commissionStatus,
      commissionNotes: l.commissionNotes,
      commissionPaidAt: l.commissionPaidAt,
    };
  });

  const soldRows = rows.filter((r) => r.sold && r.commissionStatus !== 'CANCELLED');
  const totals = {
    salesCount: soldRows.length,
    salesTotal: soldRows.reduce((a, r) => a + r.totalBRL, 0),
    commissionPending: soldRows.filter((r) => r.commissionStatus === 'PENDING' || r.commissionStatus === 'APPROVED').reduce((a, r) => a + r.commissionAmount, 0),
    commissionPaid: soldRows.filter((r) => r.commissionStatus === 'PAID').reduce((a, r) => a + r.commissionAmount, 0),
  };

  return NextResponse.json({ rows, totals, role: actor.kind });
}
