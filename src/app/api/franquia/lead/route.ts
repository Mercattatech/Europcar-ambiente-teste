import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/franquia/lead
 *
 * Recebe o formulário da landing "Seja um franqueado" e envia o lead ao CRM
 * (Mercatta Growth → /api/v1/broker/storefront, action=create_lead).
 *
 * A chave do CRM fica SOMENTE no servidor (CRM_STOREFRONT_API_KEY) — nunca vai ao navegador.
 */

const CRM_URL =
  process.env.CRM_STOREFRONT_URL || 'https://growth.grupomercatta.com.br/api/v1/broker/storefront';

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
  const apiKey = process.env.CRM_STOREFRONT_API_KEY;
  if (!apiKey) {
    console.error('[franquia/lead] CRM_STOREFRONT_API_KEY não configurada');
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 500 });
  }

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

  const sim = body?.simulation && typeof body.simulation === 'object' ? body.simulation : null;
  const simText = sim
    ? `Simulação: frota ${Number(sim.fleet) || '-'} | ocupação ${Number(sim.occupancy) || '-'}% | ticket R$ ${Number(sim.ticket) || '-'} | capital/veículo R$ ${Number(sim.vehicleCost) || '-'}`
    : '';

  const tags = ['franquia', 'expansao-2030'];
  if (capital) tags.push(`capital: ${capital}`);
  if (rental) tags.push(`locadora: ${rental}`);
  if (HOT_CAPITAL.includes(capital)) tags.push('hot');

  const notes = [
    `Cidade de interesse: ${city}`,
    capital && `Capital para investimento: ${capital}`,
    rental && `Já possui locadora: ${rental}`,
    message && `Mensagem: ${message}`,
    simText,
  ].filter(Boolean).join('\n');

  const base = {
    action: 'create_lead',
    name,
    email,
    phone,
    source: clean(body?.utm?.source, 60) || 'site_europcar_franquia',
    medium: clean(body?.utm?.medium, 60) || 'landing_page',
    campaign: clean(body?.utm?.campaign, 80) || 'expansao_2030',
    address: city,
    tags,
  };

  const send = (payload: Record<string, unknown>) =>
    fetch(CRM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

  try {
    // 1ª tentativa: com observações (cidade/capital/mensagem/simulação) como campo extra
    let res = await send({ ...base, notes, message: notes });
    // Se o CRM rejeitar campos desconhecidos, reenvia só com o contrato documentado
    if (res.status === 400 || res.status === 422) res = await send(base);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[franquia/lead] CRM respondeu ${res.status}: ${txt.slice(0, 300)}`);
      return NextResponse.json({ error: 'Não foi possível enviar agora. Tente novamente.' }, { status: 502 });
    }

    console.log(`[franquia/lead] Lead enviado ao CRM: ${email} (${city})`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[franquia/lead] Falha ao chamar o CRM:', err?.message || err);
    return NextResponse.json({ error: 'Não foi possível enviar agora. Tente novamente.' }, { status: 502 });
  }
}
