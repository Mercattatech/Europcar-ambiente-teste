import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

import { ETO_MIN_DISCOUNT_KEY, normalizeMinDiscountPercent } from '@/lib/pricing/etoPricing';

const MARGIN_KEY = 'eto_margin_percent';
const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

// GET — público (frontend precisa ler a margem para exibir preços)
// Sempre dinâmico e sem cache: um valor velho/zerado aqui vira venda sem markup.
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  try {
    const config = await prisma.contentBlock.findUnique({ where: { key: MARGIN_KEY } });
    const percent = parseFloat(config?.value_ptBR || '0');
    // Desconto mínimo do cartão vs balcão (padrão 6% se ainda não configurado)
    const minCfg = await prisma.contentBlock.findUnique({ where: { key: ETO_MIN_DISCOUNT_KEY } });
    const minDiscountPercent = normalizeMinDiscountPercent(minCfg?.value_ptBR);
    return NextResponse.json({ percent: isNaN(percent) ? 0 : percent, minDiscountPercent }, { headers: NO_STORE });
  } catch (error: any) {
    // Banco indisponível: NÃO devolver 0% (o checkout cobraria sem markup). O front trava o "Pagar agora".
    console.error('[margin] DB error, margem indisponível:', error.message);
    return NextResponse.json({ error: 'Margem indisponível' }, { status: 503, headers: NO_STORE });
  }
}

// POST — admin only
export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result: { success: true; percent?: number; minDiscountPercent?: number } = { success: true };

    if (body.percent !== undefined) {
      const value = Math.max(0, Math.min(100, parseFloat(body.percent) || 0));
      await prisma.contentBlock.upsert({
        where: { key: MARGIN_KEY },
        update: { value_ptBR: String(value) },
        create: { key: MARGIN_KEY, value_ptBR: String(value) },
      });
      result.percent = value;
    }

    if (body.minDiscountPercent !== undefined) {
      const minValue = Math.max(0, Math.min(95, parseFloat(body.minDiscountPercent) || 0));
      await prisma.contentBlock.upsert({
        where: { key: ETO_MIN_DISCOUNT_KEY },
        update: { value_ptBR: String(minValue) },
        create: { key: ETO_MIN_DISCOUNT_KEY, value_ptBR: String(minValue) },
      });
      result.minDiscountPercent = minValue;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[margin] Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar margem' }, { status: 500 });
  }
}
