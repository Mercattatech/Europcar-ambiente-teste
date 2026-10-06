import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/franquia/lead
 *
 * Recebe os dados da landing "Seja um franqueado" e envia ao webhook do n8n (Mercatta Growth).
 * É a MESMA rota e o MESMO payload para os dois canais:
 *   - channel = "site"      → botão "Enviar interesse"
 *   - channel = "whatsapp"  → botão "Enviar pelo WhatsApp"
 * O n8n identifica a origem pelo campo `channel` (e pelas tags/`source`).
 */

const WEBHOOK_URL =
  process.env.FRANQUIA_WEBHOOK_URL || 'https://n8nwebhook.mercattatech.com.br/webhook/mercatta-growth-web';

// Anti-abuso simples (em memória): máx. 5 envios por IP a cada 10 min
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits: Map<string, number[]> = ((globalThis as any).__franquiaHits ??= new Map());

function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_PER_WINDOW;
}

const clean = (v: unknown, max = 200): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';

/** Telefone → formato internacional (+55...) */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.trim().startsWith('+')) return `+${digits}`;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  return `+55${digits}`;
}

const HOT_CAPITAL = ['R$ 2,5 mi a R$ 5 mi', 'Acima de R$ 5 mi'];

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  // Honeypot: robôs preenchem; fingimos sucesso e descartamos
  if (clean(body?.website)) return NextResponse.json({ ok: true });

  const channel = clean(body?.channel, 20) === 'whatsapp' ? 'whatsapp' : 'site';
  const name = clean(body?.name, 120);
  const email = clean(body?.email, 160).toLowerCase();
  const phone = normalizePhone(clean(body?.phone, 40));
  const city = clean(body?.city, 120);
  const capital = clean(body?.capital, 60);
  const rental = clean(body?.rental, 80);
  const message = clean(body?.message, 1000);

  if (!name || !email || !phone || !city) {
    return NextResponse.json({ error: 'Preencha nome, e-mail, telefone e cidade.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const s = body?.simulation && typeof body.simulation === 'object' ? body.simulation : null;
  const simulation = s
    ? {
        fleet: Number(s.fleet) || null,
        occupancy: Number(s.occupancy) || null,
        ticket: Number(s.ticket) || null,
        vehicleCost: Number(s.vehicleCost) || null,
      }
    : null;

  const tags = ['franquia', 'expansao-2030', `canal: ${channel}`];
  if (capital) tags.push(`capital: ${capital}`);
  if (rental) tags.push(`locadora: ${rental}`);
  if (HOT_CAPITAL.includes(capital)) tags.push('hot');

  // Payload IDÊNTICO para site e WhatsApp (só muda `channel`)
  const payload = {
    action: 'create_lead',
    event: 'franquia_lead',
    channel,
    name,
    email,
    phone,
    city,
    address: city,
    capital,
    possui_locadora: rental,
    message,
    simulation,
    source: clean(body?.utm?.source, 60) || (channel === 'whatsapp' ? 'site_europcar_franquia_whatsapp' : 'site_europcar_franquia'),
    medium: clean(body?.utm?.medium, 60) || 'landing_page',
    campaign: clean(body?.utm?.campaign, 80) || 'expansao_2030',
    tags,
    page_url: clean(body?.pageUrl, 300),
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[franquia/lead] Webhook respondeu ${res.status}: ${txt.slice(0, 300)}`);
      return NextResponse.json({ error: 'Não foi possível enviar agora. Tente novamente.' }, { status: 502 });
    }

    console.log(`[franquia/lead] Lead enviado ao webhook (${channel}): ${email} (${city})`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[franquia/lead] Falha ao chamar o webhook:', err?.message || err);
    return NextResponse.json({ error: 'Não foi possível enviar agora. Tente novamente.' }, { status: 502 });
  }
}
