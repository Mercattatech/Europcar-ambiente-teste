import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

// GET /api/commissions — Listar comissões
export async function GET(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const partnerId = searchParams.get('partnerId');

  const where: any = {};
  if (status && status !== 'ALL') where.status = status;
  if (partnerId) where.partnerId = partnerId;

  const commissions = await prisma.commission.findMany({
    where,
    include: {
      partner: { select: { id: true, name: true, type: true, email: true } },
      coupon: { select: { id: true, code: true, name: true } },
      couponUsage: { select: { id: true, resNumber: true, originalValue: true, finalValue: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Totais
  const totals = await prisma.commission.groupBy({
    by: ['status'],
    where,
    _sum: { amount: true },
    _count: true,
  });

  return NextResponse.json({ commissions, totals });
}
