import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return (dbUser?.role === 'ADMIN' || dbUser?.role === 'VENDEDOR_ADMIN') && dbUser?.status !== 'BLOCKED';
}

export async function GET(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   const { searchParams } = new URL(request.url);
   const action = searchParams.get('action');
   const onlyErrors = searchParams.get('onlyErrors') === 'true';
   const search = searchParams.get('search')?.trim();
   const limit = parseInt(searchParams.get('limit') || '100');

   try {
      const where: any = {};
      if (action) where.action = action;
      if (onlyErrors) where.hasError = true;
      if (search) {
         where.OR = [
            { xmlRequest: { contains: search } },
            { xmlResponse: { contains: search } },
            { sourceFile: { contains: search } },
            { action: { contains: search } },
         ];
      }

      const logs = await prisma.logXRS.findMany({
         where,
         orderBy: { createdAt: 'desc' },
         take: limit,
      });

      return NextResponse.json(logs);
   } catch (error: any) {
      console.error('LogXRS GET error:', error);
      return NextResponse.json({ error: 'Erro ao carregar logs XRS' }, { status: 500 });
   }
}

export async function DELETE(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      await prisma.logXRS.deleteMany({});
      return NextResponse.json({ success: true });
   } catch (error: any) {
      return NextResponse.json({ error: 'Erro ao limpar logs' }, { status: 500 });
   }
}
