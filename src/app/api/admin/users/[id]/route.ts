import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

// PATCH /api/admin/users/[id] - Update user (role, status, password, name, email)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const body = await req.json();
      const updateData: any = {};

      const currentUser = await prisma.user.findUnique({
         where: { id: params.id }
      });

      if (!currentUser) {
         return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      if (body.role !== undefined) updateData.role = body.role;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.name !== undefined) updateData.name = body.name;

      let emailChanged = false;
      const oldEmail = currentUser.email ? currentUser.email.trim().toLowerCase() : null;
      let newEmail = '';

      if (body.email !== undefined) {
         newEmail = String(body.email).trim().toLowerCase();
         if (!newEmail) {
            return NextResponse.json({ error: 'O e-mail não pode ser vazio' }, { status: 400 });
         }

         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
         if (!emailRegex.test(newEmail)) {
            return NextResponse.json({ error: 'Formato de e-mail inválido' }, { status: 400 });
         }

         if (newEmail !== oldEmail) {
            // Verifica se outro usuário já usa esse e-mail
            const existingUser = await prisma.user.findFirst({
               where: {
                  email: { equals: newEmail, mode: 'insensitive' },
                  NOT: { id: params.id }
               }
            });

            if (existingUser) {
               return NextResponse.json({ error: 'Este e-mail já está sendo utilizado por outro usuário' }, { status: 400 });
            }

            updateData.email = newEmail;
            emailChanged = true;
         }
      }

      if (body.newPassword) {
         const hashed = await bcrypt.hash(body.newPassword, 10);
         updateData.password = hashed;
      }

      const updatedUser = await prisma.user.update({
         where: { id: params.id },
         data: updateData,
         select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
         }
      });

      // Se o e-mail mudou e a opção de sincronizar reservas estiver ativa (padrão true)
      let syncedReservationsCount = 0;
      if (emailChanged && oldEmail && body.syncReservations !== false) {
         try {
            const matchingReservations = await prisma.$queryRaw<Array<{ id: string; customerData: any }>>`
               SELECT id, "customerData" FROM "LocalReservation" 
               WHERE CAST("customerData" AS TEXT) ILIKE ${`%${oldEmail}%`}
            `;

            for (const res of matchingReservations) {
               let cd: any = res.customerData;
               const isString = typeof cd === 'string';
               if (isString) {
                  try { cd = JSON.parse(cd); } catch (e) { continue; }
               }
               if (!cd || typeof cd !== 'object') continue;

               let modified = false;

               const updateField = (obj: any, key: string) => {
                  if (obj && typeof obj[key] === 'string' && obj[key].trim().toLowerCase() === oldEmail) {
                     obj[key] = newEmail;
                     modified = true;
                  }
               };

               updateField(cd, 'email');
               if (cd.customer) updateField(cd.customer, 'email');
               if (cd.driver) updateField(cd.driver, 'email');
               if (cd.booking) {
                  updateField(cd.booking, 'email');
                  if (cd.booking.customer) updateField(cd.booking.customer, 'email');
                  if (cd.booking.driver) updateField(cd.booking.driver, 'email');
               }

               if (modified) {
                  await prisma.localReservation.update({
                     where: { id: res.id },
                     data: {
                        customerData: isString ? JSON.stringify(cd) : cd
                     }
                  });
                  syncedReservationsCount++;
               }
            }

            // Remove tokens de recuperação antigos para o email antigo
            await prisma.passwordResetToken.deleteMany({ where: { email: oldEmail } }).catch(() => {});
            await prisma.verificationToken.deleteMany({ where: { identifier: oldEmail } }).catch(() => {});
         } catch (syncErr) {
            console.error('Erro ao sincronizar reservas após alteração de e-mail:', syncErr);
         }
      }

      return NextResponse.json({
         ...updatedUser,
         syncedReservationsCount,
         emailChanged
      });
   } catch (error: any) {
      console.error('Error updating user:', error);
      if (error?.code === 'P2002') {
         return NextResponse.json({ error: 'Este e-mail já está cadastrado no sistema' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
   }
}

// DELETE /api/admin/users/[id] - Delete user and all related data
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      // Delete related data first (sessions, accounts)
      await prisma.session.deleteMany({ where: { userId: params.id } });
      await prisma.account.deleteMany({ where: { userId: params.id } });
      await prisma.user.delete({ where: { id: params.id } });

      return NextResponse.json({ success: true });
   } catch (error: any) {
      console.error('Error deleting user:', error);
      return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 });
   }
}
