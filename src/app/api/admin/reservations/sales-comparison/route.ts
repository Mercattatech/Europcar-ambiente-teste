import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Busca todas as reservas não-canceladas com valor
    const reservations = await prisma.localReservation.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: { amountInCents: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();

    // ── Mensal: últimos 12 meses ──────────────────────────────────────
    const monthly: { label: string; vendas: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year  = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      const items = reservations.filter(r => {
        const rd = new Date(r.createdAt);
        return rd.getFullYear() === year && rd.getMonth() === month;
      });
      monthly.push({
        label,
        vendas: items.reduce((s, r) => s + (r.amountInCents || 0) / 100, 0),
        count:  items.length,
      });
    }

    // ── Trimestral: últimos 6 trimestres ─────────────────────────────
    const quarterly: { label: string; vendas: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const totalMonths = now.getMonth() + now.getFullYear() * 12 - i * 3;
      const year  = Math.floor(totalMonths / 12);
      const qMon  = totalMonths % 12; // first month of quarter
      const qNum  = Math.floor(qMon / 3) + 1;
      const label = `T${qNum}/${String(year).slice(2)}`;
      const items = reservations.filter(r => {
        const rd   = new Date(r.createdAt);
        const rQ   = Math.floor(rd.getMonth() / 3) + 1;
        return rd.getFullYear() === year && rQ === qNum;
      });
      quarterly.push({
        label,
        vendas: items.reduce((s, r) => s + (r.amountInCents || 0) / 100, 0),
        count:  items.length,
      });
    }

    // ── Anual: últimos 4 anos ─────────────────────────────────────────
    const yearly: { label: string; vendas: number; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const year = now.getFullYear() - i;
      const items = reservations.filter(r => new Date(r.createdAt).getFullYear() === year);
      yearly.push({
        label:  String(year),
        vendas: items.reduce((s, r) => s + (r.amountInCents || 0) / 100, 0),
        count:  items.length,
      });
    }

    return NextResponse.json({ monthly, quarterly, yearly });

  } catch (error) {
    console.error('Sales comparison error:', error);
    return NextResponse.json({ error: 'Erro ao gerar comparativo' }, { status: 500 });
  }
}
