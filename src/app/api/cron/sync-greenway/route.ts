import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/sync-greenway
 *
 * Endpoint chamado pelo Coolify Scheduled Task.
 * Aceita chamadas de localhost sem secret (mesmo container).
 * Para chamadas externas, exige ?secret=CRON_SECRET.
 *
 * Coolify Command:
 *   node -e "fetch('http://localhost:3000/api/cron/sync-greenway').then(r=>r.text()).then(console.log).catch(console.error)"
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  const host = req.headers.get('host') || '';

  // Aceitar chamadas internas (localhost) OU com secret válido
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const hasValidSecret = cronSecret && secret === cronSecret;

  if (!isLocalhost && !hasValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const protocol = isLocalhost ? 'http' : (req.headers.get('x-forwarded-proto') || 'https');
    const syncUrl = `${protocol}://${host}/api/reservas/sync-greenway`;

    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();

    console.log(`[cron/sync-greenway] ${data.synced || 0} verificadas, ${data.changes || 0} alterações`);

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
