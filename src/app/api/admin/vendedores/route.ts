import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getActor } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

const sellerSelect = {
  id: true, name: true, email: true, phone: true, cpf: true, status: true,
  commissionType: true, commissionValue: true, pixKey: true, sellerNotes: true, createdAt: true,
} as const;

export async function GET() {
  const actor = await getActor();
  if (actor?.kind !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sellers = await prisma.user.findMany({
    where: { role: 'VENDEDOR' },
    select: sellerSelect,
    orderBy: { createdAt: 'desc' },
  });
  const links = await prisma.paymentLink.groupBy({
    by: ['sellerId', 'status'],
    _count: { _all: true },
  });
  const result = sellers.map((s) => {
    const mine = links.filter((l) => l.sellerId === s.id);
    return {
      ...s,
      linksCreated: mine.reduce((a, l) => a + l._count._all, 0),
      linksUsed: mine.filter((l) => l.status === 'USED').reduce((a, l) => a + l._count._all, 0),
    };
  });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const actor = await getActor();
  if (actor?.kind !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim();
  if (!name || !email || !b.password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
  }
  if (String(b.password).length < 6) {
    return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres' }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 });
  }
  const seller = await prisma.user.create({
    data: {
      name, email,
      password: await bcrypt.hash(String(b.password), 10),
      role: 'VENDEDOR',
      status: 'ACTIVE',
      phone: b.phone || null,
      cpf: b.cpf || null,
      commissionType: b.commissionType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
      commissionValue: Number(b.commissionValue) || 0,
      pixKey: b.pixKey || null,
      sellerNotes: b.sellerNotes || null,
    },
    select: sellerSelect,
  });
  return NextResponse.json(seller);
}

