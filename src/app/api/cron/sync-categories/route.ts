import { NextResponse } from 'next/server';
import { syncCategoriesFromXRS } from '@/lib/europcar/syncCategories';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron: GET /api/cron/sync-categories
 * Agendamento diário: 00:00 (expressão cron: 0 0 * * * ou 0 3 * * * UTC para 00:00 BRT)
 *
 * Consulta a API XRS da Europcar para estações do Brasil e Europa, sincronizando os
 * códigos ACRISS, nomes de modelos e status On-Request (LIMITED) com o banco de dados.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secretParam = searchParams.get('secret');
  const authHeader = req.headers.get('authorization');
  const host = req.headers.get('host') || '';
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const cronSecret = process.env.CRON_SECRET || '';

  const isAuthorized =
    !cronSecret ||
    isLocalhost ||
    authHeader === `Bearer ${cronSecret}` ||
    secretParam === cronSecret;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startedAt = new Date();
    const result = await syncCategoriesFromXRS();
    const durationMs = Date.now() - startedAt.getTime();

    return NextResponse.json({
      success: true,
      message: `Sincronização de categorias XRS concluída em ${durationMs}ms`,
      durationMs,
      ...result,
    });
  } catch (error: any) {
    console.error('[cron/sync-categories] Erro ao sincronizar categorias:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao sincronizar categorias da XRS' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
