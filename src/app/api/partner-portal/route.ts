import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

// GET /api/partner-portal?token=xxx — Dashboard + dados do parceiro
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
  }

  const partner = await prisma.partner.findUnique({
    where: { referralToken: token },
    include: {
      coupons: {
        where: { status: { in: ['ACTIVE', 'PAUSED', 'EXPIRED'] } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, code: true, name: true, discountType: true, discountValue: true,
          status: true, currentUses: true, maxUses: true, createdAt: true,
        },
      },
      couponUsages: {
        orderBy: { usedAt: 'desc' },
        take: 50,
        select: {
          id: true, couponCodeSnapshot: true, originalValue: true, discountAmount: true,
          finalValue: true, commissionAmount: true, customerNamePartial: true, status: true, usedAt: true,
        },
      },
      commissions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, amount: true, status: true, availableAt: true, paidAt: true, createdAt: true,
        },
      },
    },
  });

  if (!partner) {
    return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });
  }

  if (partner.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Acesso desativado. Contate o administrador.' }, { status: 403 });
  }

  // Agregar stats
  const salesAgg = await prisma.couponUsage.aggregate({
    where: { partnerId: partner.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    _sum: { finalValue: true, discountAmount: true, commissionAmount: true },
    _count: true,
  });

  const commPaid = await prisma.commission.aggregate({
    where: { partnerId: partner.id, status: 'PAID' },
    _sum: { amount: true },
  });

  const commPending = await prisma.commission.aggregate({
    where: { partnerId: partner.id, status: { in: ['FORECAST', 'PENDING', 'RELEASED'] } },
    _sum: { amount: true },
  });

  return NextResponse.json({
    partner: {
      name: partner.name,
      tradeName: partner.tradeName,
      type: partner.type,
      email: partner.email,
      commissionEnabled: partner.commissionEnabled,
      commissionType: partner.commissionType,
      commissionValue: partner.commissionValue,
    },
    coupons: partner.coupons,
    sales: partner.couponUsages,
    commissions: partner.commissions,
    stats: {
      totalSales: salesAgg._count,
      revenue: salesAgg._sum.finalValue || 0,
      discount: salesAgg._sum.discountAmount || 0,
      commissionTotal: salesAgg._sum.commissionAmount || 0,
      commissionPaid: commPaid._sum.amount || 0,
      commissionPending: commPending._sum.amount || 0,
    },
  });
}
