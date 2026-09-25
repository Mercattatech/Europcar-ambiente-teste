import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import crypto from 'crypto';
export const dynamic = 'force-dynamic';

// GET /api/partners — Listar parceiros
export async function GET(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const where: any = {};
  if (type && type !== 'ALL') where.type = type;
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { cpf: { contains: search } },
      { cnpj: { contains: search } },
      { company: { contains: search, mode: 'insensitive' } },
    ];
  }

  const partners = await prisma.partner.findMany({
    where,
    include: {
      _count: { select: { coupons: true, couponUsages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Agregar receita e comissão por parceiro
  const enriched = await Promise.all(partners.map(async (p) => {
    const agg = await prisma.couponUsage.aggregate({
      where: { partnerId: p.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _sum: { finalValue: true, discountAmount: true, commissionAmount: true },
    });
    const commAgg = await prisma.commission.aggregate({
      where: { partnerId: p.id },
      _sum: { amount: true },
    });
    const commPaid = await prisma.commission.aggregate({
      where: { partnerId: p.id, status: 'PAID' },
      _sum: { amount: true },
    });

    return {
      ...p,
      stats: {
        coupons: p._count.coupons,
        sales: p._count.couponUsages,
        revenue: agg._sum.finalValue || 0,
        discount: agg._sum.discountAmount || 0,
        commissionTotal: commAgg._sum.amount || 0,
        commissionPaid: commPaid._sum.amount || 0,
        commissionPending: (commAgg._sum.amount || 0) - (commPaid._sum.amount || 0),
      },
    };
  }));

  return NextResponse.json(enriched);
}

// POST /api/partners — Criar parceiro
export async function POST(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    }

    // Verificar email único (se fornecido)
    if (body.email) {
      const exists = await prisma.partner.findUnique({ where: { email: body.email.toLowerCase() } });
      if (exists) return NextResponse.json({ error: 'Já existe um parceiro com este e-mail.' }, { status: 409 });
    }

    // Gerar referral token único
    const referralToken = crypto.randomUUID() + '-' + crypto.randomBytes(8).toString('hex');

    const partner = await prisma.partner.create({
      data: {
        name: body.name,
        tradeName: body.tradeName || null,
        type: body.type || 'OTHER',
        cpf: body.cpf || null,
        cnpj: body.cnpj || null,
        email: body.email?.toLowerCase() || null,
        whatsapp: body.whatsapp || null,
        phone: body.phone || null,
        company: body.company || null,
        position: body.position || null,
        city: body.city || null,
        state: body.state || null,
        country: body.country || 'BR',
        instagram: body.instagram || null,
        tiktok: body.tiktok || null,
        youtube: body.youtube || null,
        linkedin: body.linkedin || null,
        website: body.website || null,
        notes: body.notes || null,
        bankName: body.bankName || null,
        bankAgency: body.bankAgency || null,
        bankAccount: body.bankAccount || null,
        pixKey: body.pixKey || null,
        bankHolder: body.bankHolder || null,
        bankHolderDoc: body.bankHolderDoc || null,
        commissionEnabled: body.commissionEnabled || false,
        commissionType: body.commissionType || null,
        commissionValue: body.commissionValue ? parseFloat(body.commissionValue) : null,
        commissionBase: body.commissionBase || 'PAID',
        commissionReleaseDelayDays: body.commissionReleaseDelayDays ? parseInt(body.commissionReleaseDelayDays) : 7,
        referralToken,
        status: body.status || 'ACTIVE',
      },
    });

    return NextResponse.json(partner, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/partners] Erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
