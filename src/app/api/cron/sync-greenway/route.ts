import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Permitir até 60s no Vercel

/**
 * GET /api/cron/sync-greenway
 *
 * Endpoint para ser chamado pela Vercel Cron (vercel.json).
 * Dispara a sincronização de status das reservas com o Greenway/XRS.
 *
 * Para ativar, adicione ao vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-greenway",
 *     "schedule": "*/15 * * * *"
 *   }]
 * }
 *
 * E defina CRON_SECRET nas env vars da Vercel.
 */
export async function GET(req: Request) {
  // Verificar authorization da Vercel Cron
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Chamar a API de sync internamente
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || '';
    const syncUrl = `${protocol}://${host}/api/reservas/sync-greenway`;

    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    console.log(`[cron/sync-greenway] Resultado: ${data.synced} verificadas, ${data.changes} alterações`);

    return NextResponse.json({
      ok: true,
      ...data,
      executedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[cron/sync-greenway] Erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
