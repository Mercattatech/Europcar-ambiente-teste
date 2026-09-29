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
   return dbUser?.role === 'ADMIN';
}

export async function GET(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { searchParams } = new URL(req.url);
      const statusFilter = searchParams.get('status');
      const opStatusFilter = searchParams.get('operationalStatus');
      const search = searchParams.get('search');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      // Se tem busca de texto, usar raw query para ILIKE no JSON (case-insensitive)
      if (search) {
         const conditions: string[] = [];
         const params: any[] = [];
         let paramIndex = 1;

         // Busca no resNumber
         conditions.push(`"resNumber" ILIKE $${paramIndex}`);
         params.push(`%${search}%`);
         paramIndex++;

         // Busca no merchantOrderId
         conditions.push(`"merchantOrderId" ILIKE $${paramIndex}`);
         params.push(`%${search}%`);
         paramIndex++;

         // Busca dentro do JSON customerData (cast para texto para ILIKE)
         conditions.push(`CAST("customerData" AS TEXT) ILIKE $${paramIndex}`);
         params.push(`%${search}%`);
         paramIndex++;

         let sql = `SELECT * FROM "LocalReservation" WHERE (${conditions.join(' OR ')})`;

         // Filtro por status
         if (statusFilter && statusFilter !== 'ALL') {
            if (statusFilter === 'CANCELLED') {
               sql += ` AND ("status" = 'CANCELLED' OR "status" = 'CANCELLED_GREENWAY')`;
            } else {
               sql += ` AND "status" = $${paramIndex}`;
               params.push(statusFilter);
               paramIndex++;
            }
         }

         // Filtro por status operacional
         if (opStatusFilter && opStatusFilter !== 'ALL') {
            if (opStatusFilter === 'R') {
               sql += ` AND ("operationalStatus" = 'R' OR "operationalStatus" IS NULL)`;
            } else if (opStatusFilter === 'ACTIVE') {
               sql += ` AND ("operationalStatus" IN ('R', 'S', 'CF') OR "operationalStatus" IS NULL)`;
            } else if (opStatusFilter === 'DONE') {
               sql += ` AND "operationalStatus" IN ('CC', 'CP', 'CO', 'TD', 'NS')`;
            } else {
               sql += ` AND "operationalStatus" = $${paramIndex}`;
               params.push(opStatusFilter);
               paramIndex++;
            }
         }

         // Filtro por data (com timezone BRT América/São Paulo UTC-3)
         if (startDate) {
            const start = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
               ? new Date(`${startDate}T00:00:00-03:00`)
               : new Date(startDate);
            sql += ` AND "createdAt" >= $${paramIndex}`;
            params.push(start);
            paramIndex++;
         }
         if (endDate) {
            const end = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
               ? new Date(`${endDate}T23:59:59.999-03:00`)
               : new Date(endDate);
            sql += ` AND "createdAt" <= $${paramIndex}`;
            params.push(end);
            paramIndex++;
         }

         sql += ` ORDER BY "createdAt" DESC`;

         const rawReservations: any[] = await prisma.$queryRawUnsafe(sql, ...params);
         // Raw queries retornam BigInt para Int — converter para Number para serialização JSON
         const reservations = rawReservations.map((r: any) => ({
            ...r,
            amountInCents: r.amountInCents ? Number(r.amountInCents) : null,
         }));
         return NextResponse.json(reservations);
      }

      // Sem busca de texto — usar Prisma com array de condições AND para evitar conflitos de OR
      const andConditions: any[] = [];

      if (statusFilter && statusFilter !== 'ALL') {
         if (statusFilter === 'CANCELLED') {
            andConditions.push({ status: { in: ['CANCELLED', 'CANCELLED_GREENWAY'] } });
         } else {
            andConditions.push({ status: statusFilter });
         }
      }

      if (opStatusFilter && opStatusFilter !== 'ALL') {
         if (opStatusFilter === 'R') {
            andConditions.push({
               OR: [
                  { operationalStatus: 'R' },
                  { operationalStatus: null }
               ]
            });
         } else if (opStatusFilter === 'ACTIVE') {
            andConditions.push({
               OR: [
                  { operationalStatus: { in: ['R', 'S', 'CF'] } },
                  { operationalStatus: null }
               ]
            });
         } else if (opStatusFilter === 'DONE') {
            andConditions.push({
               operationalStatus: { in: ['CC', 'CP', 'CO', 'TD', 'NS'] }
            });
         } else {
            andConditions.push({ operationalStatus: opStatusFilter });
         }
      }

      if (startDate || endDate) {
         const dateClause: any = {};
         if (startDate) {
            dateClause.gte = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
               ? new Date(`${startDate}T00:00:00-03:00`)
               : new Date(startDate);
         }
         if (endDate) {
            dateClause.lte = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
               ? new Date(`${endDate}T23:59:59.999-03:00`)
               : new Date(endDate);
         }
         andConditions.push({ createdAt: dateClause });
      }

      const where = andConditions.length > 0 ? { AND: andConditions } : {};

      const reservations = await prisma.localReservation.findMany({
         where,
         orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json(reservations);
   } catch (error: any) {
      console.error('Error fetching reservations:', error);
      return NextResponse.json({ error: 'Erro ao buscar reservas' }, { status: 500 });
   }
}
