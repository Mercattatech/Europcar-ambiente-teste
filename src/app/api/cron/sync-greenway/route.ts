import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sync-greenway
 *
 * Endpoint para ser chamado por cron externo (Coolify, crontab, etc).
 * Dispara a sincronização de status das reservas com o Greenway/XRS.
 *
 * Para ativar no Coolify, adicione um Scheduled Task (cron):
 *   Comando: curl -s -X GET "https://seudominio.com/api/cron/sync-greenway?secret=SEU_CRON_SECRET"
 *   Frequência: */15 * * * * (a cada 15 minutos)
 *
 * Ou via crontab do servidor:
 *   */15 * * * * curl -s "https://seudominio.com/api/cron/sync-greenway?secret=SEU_CRON_SECRET" > /dev/null 2>&1
 *
 * Defina CRON_SECRET nas variáveis de ambiente do Coolify.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado nas variáveis de ambiente' }, { status: 500 });
  }

  if (secret !== cronSecret) {
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
