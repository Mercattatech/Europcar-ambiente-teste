import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

// GET /api/coupons — Listar cupons com filtros
export async function GET(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const couponType = searchParams.get('couponType');
  const partnerId = searchParams.get('partnerId');
  const campaign = searchParams.get('campaign');
  const search = searchParams.get('search');

  const where: any = {};
  if (status && status !== 'ALL') where.status = status;
  if (couponType && couponType !== 'ALL') where.couponType = couponType;
  if (partnerId) where.partnerId = partnerId;
  if (campaign) where.campaign = campaign;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { campaign: { contains: search, mode: 'insensitive' } },
      { partner: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const coupons = await prisma.coupon.findMany({
    where,
    include: {
      partner: { select: { id: true, name: true, type: true } },
      _count: { select: { usages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Agregar receita e comissão por cupom
  const enriched = await Promise.all(coupons.map(async (c) => {
    const agg = await prisma.couponUsage.aggregate({
      where: { couponId: c.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _sum: { originalValue: true, discountAmount: true, finalValue: true, commissionAmount: true },
    });
    return {
      ...c,
      stats: {
        uses: c._count.usages,
        revenue: agg._sum.finalValue || 0,
        discount: agg._sum.discountAmount || 0,
        commission: agg._sum.commissionAmount || 0,
      },
    };
  }));

  return NextResponse.json(enriched);
}

// POST /api/coupons — Criar cupom
export async function POST(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Validar código único
    const code = (body.code || '').toUpperCase().trim();
    if (!code) {
      return NextResponse.json({ error: 'Código do cupom é obrigatório.' }, { status: 400 });
    }
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: `Já existe um cupom com o código "${code}".` }, { status: 409 });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        name: body.name || code,
        description: body.description || null,
        couponType: body.couponType || 'PROMOTIONAL',
        discountType: body.discountType || 'PERCENTAGE',
        discountValue: body.discountValue ? parseFloat(body.discountValue) : null,
        maxDiscount: body.maxDiscount ? parseFloat(body.maxDiscount) : null,
        minimumOrderValue: body.minimumOrderValue ? parseFloat(body.minimumOrderValue) : null,
        stackable: body.stackable || false,
        allowedCategories: body.allowedCategories || null,
        excludedCategories: body.excludedCategories || null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        hasExpiration: !!body.expiresAt,
        maxUses: body.maxUses ? parseInt(body.maxUses) : null,
        maxUsesPerCustomer: body.maxUsesPerCustomer ? parseInt(body.maxUsesPerCustomer) : 1,
        maxUsesPerDay: body.maxUsesPerDay ? parseInt(body.maxUsesPerDay) : null,
        maxUsesPerMonth: body.maxUsesPerMonth ? parseInt(body.maxUsesPerMonth) : null,
        status: body.status || 'DRAFT',
        partnerId: body.partnerId || null,
        campaign: body.campaign || null,
        requiresApproval: body.requiresApproval || false,
        createdBy: body.createdBy || null,
      },
      include: { partner: true },
    });

    // Auditoria
    await prisma.couponAuditLog.create({
      data: {
        couponId: coupon.id,
        userId: body.createdBy || null,
        action: 'CREATED',
        newData: coupon as any,
      },
    });

    return NextResponse.json(coupon, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/coupons] Erro:', err);
    return NextResponse.json({ error: err.message || 'Erro ao criar cupom.' }, { status: 500 });
  }
}
