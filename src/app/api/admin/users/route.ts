import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkAdmin } from '@/lib/checkAdmin';
import { isSellerRole, normalizeUserRole } from '@/lib/sellerCommission';

export const dynamic = 'force-dynamic';

export async function GET() {
   try {
      if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
      return NextResponse.json(users);
   } catch (error) {
      return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
   }
}

export async function POST(req: Request) {
   try {
      if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const body = await req.json();
      const { name, password, phone, cpf, commissionType, commissionValue, pixKey, sellerNotes } = body;
      const email = String(body.email || '').trim().toLowerCase();
      const role = normalizeUserRole(body.role);

      if (!email || !password) {
         return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
      }

      const exist = await prisma.user.findUnique({ where: { email } });
      if (exist) {
         return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const sellerFields = isSellerRole(role)
         ? {
              commissionType: commissionType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
              commissionValue: commissionValue !== undefined && commissionValue !== '' ? (Number(commissionValue) || 0) : 5,
              pixKey: pixKey || null,
              sellerNotes: sellerNotes || null,
           }
         : {};

      const user = await prisma.user.create({
         data: {
            name,
            email,
            password: hashedPassword,
            role,
            status: 'ACTIVE',
            ...(phone !== undefined ? { phone: phone || null } : {}),
            ...(cpf !== undefined ? { cpf: cpf || null } : {}),
            ...sellerFields,
         }
      });

      return NextResponse.json(user);
   } catch (error: any) {
      console.error(error);
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
   }
}

// Keeping PUT just in case something still uses it, but we prefer PATCH on [id]
export async function PUT(req: Request) {
   try {
      if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { id, role, email, name } = await req.json();
      const updateData: any = {};
      if (role !== undefined) updateData.role = normalizeUserRole(role);
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = String(email).trim().toLowerCase();
      const updatedUser = await prisma.user.update({
         where: { id },
         data: updateData
      });
      return NextResponse.json(updatedUser);
   } catch (error) {
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
   }
}
