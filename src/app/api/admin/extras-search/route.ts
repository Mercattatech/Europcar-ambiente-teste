import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

/**
 * Liga/desliga, para TODAS as buscas do site, a exibição de:
 *   - Proteções (seguros da XRS + upsell de franquia zero)
 *   - Extras (equipamentos/acessórios da XRS)
 * Além das chaves gerais, cada proteção/extra pode ser desativado individualmente (lista de códigos XRS).
 * Padrão: ativo (quando a chave não existe ou o banco falha, o site continua mostrando como antes).
 */
const PROTECTIONS_KEY = 'extras_search_protections_enabled';
const EXTRAS_KEY = 'extras_search_extras_enabled';
const DISABLED_PROTECTIONS_KEY = 'extras_search_disabled_protections';
const DISABLED_EXTRAS_KEY = 'extras_search_disabled_extras';
const ALL_KEYS = [PROTECTIONS_KEY, EXTRAS_KEY, DISABLED_PROTECTIONS_KEY, DISABLED_EXTRAS_KEY];
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

const parseList = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
};

const sanitizeList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((x): x is string => typeof x === 'string').map((x) => x.trim().toUpperCase()).filter((x) => x && x.length <= 40))).slice(0, 300)
    : [];

async function readConfig() {
  const rows = await prisma.contentBlock.findMany({ where: { key: { in: ALL_KEYS } } });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value_ptBR]));
  return {
    protections: isEnabled(byKey[PROTECTIONS_KEY]),
    extras: isEnabled(byKey[EXTRAS_KEY]),
    disabledProtections: parseList(byKey[DISABLED_PROTECTIONS_KEY]),
    disabledExtras: parseList(byKey[DISABLED_EXTRAS_KEY]),
  };
}

// GET — público (a página de veículos precisa ler para decidir o que exibir)
export async function GET() {
  try {
    return NextResponse.json(await readConfig(), { headers: NO_STORE });
  } catch (error: any) {
    console.error('[extras-search] DB error, mantendo padrão (ativo):', error.message);
    return NextResponse.json({ protections: true, extras: true, disabledProtections: [], disabledExtras: [], fallback: true }, { headers: NO_STORE });
  }
}

// POST — somente admin. Aceita { protections?, extras?: boolean; disabledProtections?, disabledExtras?: string[] }
export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updates: [string, string][] = [];
    if (typeof body.protections === 'boolean') updates.push([PROTECTIONS_KEY, String(body.protections)]);
    if (typeof body.extras === 'boolean') updates.push([EXTRAS_KEY, String(body.extras)]);
    if (Array.isArray(body.disabledProtections)) updates.push([DISABLED_PROTECTIONS_KEY, JSON.stringify(sanitizeList(body.disabledProtections))]);
    if (Array.isArray(body.disabledExtras)) updates.push([DISABLED_EXTRAS_KEY, JSON.stringify(sanitizeList(body.disabledExtras))]);
    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    }

    for (const [key, value] of updates) {
      await prisma.contentBlock.upsert({
        where: { key },
        update: { value_ptBR: value },
        create: { key, value_ptBR: value },
      });
    }

    return NextResponse.json({ success: true, ...(await readConfig()) });
  } catch (error: any) {
    console.error('[extras-search] Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
  }
}
