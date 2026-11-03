import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

/**
 * Liga/desliga, para TODAS as buscas do site, a exibição de:
 *   - Proteções (seguros da XRS + upsell de franquia zero)
 *   - Extras (equipamentos/acessórios da XRS)
 * Padrão: ativo (quando a chave não existe ou o banco falha, o site continua mostrando como antes).
 */
const PROTECTIONS_KEY = 'extras_search_protections_enabled';
const EXTRAS_KEY = 'extras_search_extras_enabled';
const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

const isEnabled = (value?: string | null) => value !== 'false'; // ausente = ativo

// GET — público (a página de veículos precisa ler para decidir o que exibir)
export async function GET() {
  try {
    const rows = await prisma.contentBlock.findMany({ where: { key: { in: [PROTECTIONS_KEY, EXTRAS_KEY] } } });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value_ptBR]));
    return NextResponse.json(
      { protections: isEnabled(byKey[PROTECTIONS_KEY]), extras: isEnabled(byKey[EXTRAS_KEY]) },
      { headers: NO_STORE },
    );
  } catch (error: any) {
    console.error('[extras-search] DB error, mantendo padrão (ativo):', error.message);
    return NextResponse.json({ protections: true, extras: true, fallback: true }, { headers: NO_STORE });
  }
}

// POST — somente admin. Aceita { protections?: boolean, extras?: boolean }
export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updates: [string, boolean][] = [];
    if (typeof body.protections === 'boolean') updates.push([PROTECTIONS_KEY, body.protections]);
    if (typeof body.extras === 'boolean') updates.push([EXTRAS_KEY, body.extras]);
    if (updates.length === 0) {
      return NextResponse.json({ error: 'Informe protections e/ou extras (boolean).' }, { status: 400 });
    }

    for (const [key, enabled] of updates) {
      await prisma.contentBlock.upsert({
        where: { key },
        update: { value_ptBR: String(enabled) },
        create: { key, value_ptBR: String(enabled) },
      });
    }

    const rows = await prisma.contentBlock.findMany({ where: { key: { in: [PROTECTIONS_KEY, EXTRAS_KEY] } } });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value_ptBR]));
    return NextResponse.json({
      success: true,
      protections: isEnabled(byKey[PROTECTIONS_KEY]),
      extras: isEnabled(byKey[EXTRAS_KEY]),
    });
  } catch (error: any) {
    console.error('[extras-search] Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  }
}
