import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const MARGIN_KEY = 'eto_margin_percent';
// Markup próprio da Proteção Premium (ETO Zero Excess, CID 56935495). Sem valor salvo => usa a margem ETO geral.
const ZERO_MARGIN_KEY = 'eto_zero_excess_margin_percent';
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
    const basePercent = isNaN(percent) ? 0 : percent;
    const zeroCfg = await prisma.contentBlock.findUnique({ where: { key: ZERO_MARGIN_KEY } });
    const zeroParsed = zeroCfg?.value_ptBR ? parseFloat(zeroCfg.value_ptBR) : NaN;
    const zeroExcessPercent = isNaN(zeroParsed) || zeroParsed < 0 ? basePercent : zeroParsed;
    return NextResponse.json({ percent: basePercent, zeroExcessPercent }, { headers: NO_STORE });
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
    const { percent, zeroExcessPercent } = await request.json();
    let value: number | undefined;
    if (percent !== undefined) {
      value = Math.max(0, parseFloat(percent) || 0);
      await prisma.contentBlock.upsert({
        where: { key: MARGIN_KEY },
        update: { value_ptBR: String(value) },
        create: { key: MARGIN_KEY, value_ptBR: String(value) },
      });
    }
    let zeroValue: number | undefined;
    if (zeroExcessPercent !== undefined) {
      // Sem limitação de 100% — usuário pode colocar quanto % quiser da tarifa premium
      zeroValue = Math.max(0, parseFloat(zeroExcessPercent) || 0);
      await prisma.contentBlock.upsert({
        where: { key: ZERO_MARGIN_KEY },
        update: { value_ptBR: String(zeroValue) },
        create: { key: ZERO_MARGIN_KEY, value_ptBR: String(zeroValue) },
      });
    }

    return NextResponse.json({ success: true, percent: value, zeroExcessPercent: zeroValue });
  } catch (error: any) {
    console.error('[margin] Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar margem' }, { status: 500 });
  }
}
