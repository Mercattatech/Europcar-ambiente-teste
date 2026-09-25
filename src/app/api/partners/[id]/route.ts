import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

// GET /api/partners/[id] — Detalhe 360° do parceiro
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const partner = await prisma.partner.findUnique({
    where: { id: params.id },
    include: {
      coupons: { orderBy: { createdAt: 'desc' } },
      couponUsages: { orderBy: { usedAt: 'desc' }, take: 100 },
      commissions: { orderBy: { createdAt: 'desc' }, take: 100 },
      _count: { select: { coupons: true, couponUsages: true, commissions: true } },
    },
  });

  if (!partner) {
    return NextResponse.json({ error: 'Parceiro não encontrado' }, { status: 404 });
  }

  // Agregar stats
  const salesAgg = await prisma.couponUsage.aggregate({
    where: { partnerId: partner.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    _sum: { originalValue: true, discountAmount: true, finalValue: true, commissionAmount: true },
    _avg: { finalValue: true },
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
    ...partner,
    stats: {
      totalCoupons: partner._count.coupons,
      totalSales: partner._count.couponUsages,
      revenue: salesAgg._sum.finalValue || 0,
      discount: salesAgg._sum.discountAmount || 0,
      ticketMedio: salesAgg._avg.finalValue || 0,
      commissionTotal: salesAgg._sum.commissionAmount || 0,
      commissionPaid: commPaid._sum.amount || 0,
      commissionPending: commPending._sum.amount || 0,
    },
  });
}

// PUT /api/partners/[id] — Editar parceiro
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = await prisma.partner.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.tradeName !== undefined && { tradeName: body.tradeName }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.cpf !== undefined && { cpf: body.cpf }),
        ...(body.cnpj !== undefined && { cnpj: body.cnpj }),
        ...(body.email !== undefined && { email: body.email?.toLowerCase() || null }),
        ...(body.whatsapp !== undefined && { whatsapp: body.whatsapp }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.company !== undefined && { company: body.company }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.state !== undefined && { state: body.state }),
        ...(body.country !== undefined && { country: body.country }),
        ...(body.instagram !== undefined && { instagram: body.instagram }),
        ...(body.tiktok !== undefined && { tiktok: body.tiktok }),
        ...(body.youtube !== undefined && { youtube: body.youtube }),
        ...(body.linkedin !== undefined && { linkedin: body.linkedin }),
        ...(body.website !== undefined && { website: body.website }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.bankName !== undefined && { bankName: body.bankName }),
        ...(body.bankAgency !== undefined && { bankAgency: body.bankAgency }),
        ...(body.bankAccount !== undefined && { bankAccount: body.bankAccount }),
        ...(body.pixKey !== undefined && { pixKey: body.pixKey }),
        ...(body.bankHolder !== undefined && { bankHolder: body.bankHolder }),
        ...(body.bankHolderDoc !== undefined && { bankHolderDoc: body.bankHolderDoc }),
        ...(body.commissionEnabled !== undefined && { commissionEnabled: body.commissionEnabled }),
        ...(body.commissionType !== undefined && { commissionType: body.commissionType }),
        ...(body.commissionValue !== undefined && { commissionValue: body.commissionValue ? parseFloat(body.commissionValue) : null }),
        ...(body.commissionBase !== undefined && { commissionBase: body.commissionBase }),
        ...(body.commissionReleaseDelayDays !== undefined && { commissionReleaseDelayDays: parseInt(body.commissionReleaseDelayDays) }),
        ...(body.status !== undefined && { status: body.status }),
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[PUT /api/partners/[id]] Erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
