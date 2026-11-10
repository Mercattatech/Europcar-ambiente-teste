import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getActor } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor?.kind !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target || target.role !== 'VENDEDOR') {
    return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 });
  }
  const b = await req.json();
  const data: any = {};
  if (b.name !== undefined) data.name = String(b.name).trim();
  if (b.phone !== undefined) data.phone = b.phone || null;
  if (b.cpf !== undefined) data.cpf = b.cpf || null;
  if (b.pixKey !== undefined) data.pixKey = b.pixKey || null;
  if (b.sellerNotes !== undefined) data.sellerNotes = b.sellerNotes || null;
  if (b.status === 'ACTIVE' || b.status === 'BLOCKED') data.status = b.status;
  if (b.commissionType !== undefined) data.commissionType = b.commissionType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
  if (b.commissionValue !== undefined) data.commissionValue = Number(b.commissionValue) || 0;
  if (b.email !== undefined) {
    const email = String(b.email).trim().toLowerCase();
    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup && dup.id !== target.id) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 });
    data.email = email;
  }
  if (b.password) {
    if (String(b.password).length < 6) return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres' }, { status: 400 });
    data.password = await bcrypt.hash(String(b.password), 10);
  }
  await prisma.user.update({ where: { id: target.id }, data });
  return NextResponse.json({ success: true });
}

