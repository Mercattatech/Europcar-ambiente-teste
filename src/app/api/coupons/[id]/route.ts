import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

// GET /api/coupons/[id] — Detalhe completo do cupom
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const coupon = await prisma.coupon.findUnique({
    where: { id: params.id },
    include: {
      partner: true,
      usages: {
        orderBy: { usedAt: 'desc' },
        take: 50,
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      _count: { select: { usages: true, commissions: true } },
    },
  });

  if (!coupon) {
    return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });
  }

  // Agregar estatísticas
  const agg = await prisma.couponUsage.aggregate({
    where: { couponId: coupon.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    _sum: { originalValue: true, discountAmount: true, finalValue: true, commissionAmount: true },
    _avg: { finalValue: true },
  });

  return NextResponse.json({
    ...coupon,
    stats: {
      totalUses: coupon._count.usages,
      revenue: agg._sum.finalValue || 0,
      discount: agg._sum.discountAmount || 0,
      commission: agg._sum.commissionAmount || 0,
      ticketMedio: agg._avg.finalValue || 0,
    },
  });
}

// PUT /api/coupons/[id] — Editar cupom
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const old = await prisma.coupon.findUnique({ where: { id: params.id } });
    if (!old) return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });

    // Se mudou o código, verificar unicidade
    if (body.code && body.code.toUpperCase().trim() !== old.code) {
      const exists = await prisma.coupon.findUnique({ where: { code: body.code.toUpperCase().trim() } });
      if (exists) return NextResponse.json({ error: `Código "${body.code}" já existe.` }, { status: 409 });
    }

    const updated = await prisma.coupon.update({
      where: { id: params.id },
      data: {
        ...(body.code && { code: body.code.toUpperCase().trim() }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.couponType && { couponType: body.couponType }),
        ...(body.discountType && { discountType: body.discountType }),
        ...(body.discountValue !== undefined && { discountValue: body.discountValue ? parseFloat(body.discountValue) : null }),
        ...(body.maxDiscount !== undefined && { maxDiscount: body.maxDiscount ? parseFloat(body.maxDiscount) : null }),
        ...(body.minimumOrderValue !== undefined && { minimumOrderValue: body.minimumOrderValue ? parseFloat(body.minimumOrderValue) : null }),
        ...(body.stackable !== undefined && { stackable: body.stackable }),
        ...(body.allowedCategories !== undefined && { allowedCategories: body.allowedCategories }),
        ...(body.excludedCategories !== undefined && { excludedCategories: body.excludedCategories }),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null, hasExpiration: !!body.expiresAt }),
        ...(body.maxUses !== undefined && { maxUses: body.maxUses ? parseInt(body.maxUses) : null }),
        ...(body.maxUsesPerCustomer !== undefined && { maxUsesPerCustomer: body.maxUsesPerCustomer ? parseInt(body.maxUsesPerCustomer) : null }),
        ...(body.maxUsesPerDay !== undefined && { maxUsesPerDay: body.maxUsesPerDay ? parseInt(body.maxUsesPerDay) : null }),
        ...(body.maxUsesPerMonth !== undefined && { maxUsesPerMonth: body.maxUsesPerMonth ? parseInt(body.maxUsesPerMonth) : null }),
        ...(body.status && { status: body.status }),
        ...(body.partnerId !== undefined && { partnerId: body.partnerId || null }),
        ...(body.campaign !== undefined && { campaign: body.campaign }),
        ...(body.requiresApproval !== undefined && { requiresApproval: body.requiresApproval }),
      },
      include: { partner: true },
    });

    // Auditoria
    await prisma.couponAuditLog.create({
      data: {
        couponId: params.id,
        userId: body.userId || null,
        action: body.status && body.status !== old.status
          ? body.status === 'ACTIVE' ? 'ACTIVATED'
            : body.status === 'PAUSED' ? 'PAUSED'
            : body.status === 'CLOSED' ? 'CLOSED'
            : 'UPDATED'
          : 'UPDATED',
        oldData: old as any,
        newData: updated as any,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[PUT /api/coupons/[id]] Erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/coupons/[id] — Excluir cupom (soft: status CLOSED)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const coupon = await prisma.coupon.findUnique({ where: { id: params.id } });
  if (!coupon) return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });

  await prisma.coupon.update({
    where: { id: params.id },
    data: { status: 'CLOSED' },
  });

  await prisma.couponAuditLog.create({
    data: {
      couponId: params.id,
      action: 'CLOSED',
      oldData: { status: coupon.status },
      newData: { status: 'CLOSED' },
    },
  });

  return NextResponse.json({ ok: true });
}
