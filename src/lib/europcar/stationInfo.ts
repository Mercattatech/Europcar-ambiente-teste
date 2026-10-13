/**
 * stationInfo
 *
 * Nome e endereço completo de uma loja (estação) Europcar a partir do código (ex.: LISX02),
 * via XRS getStation. Usado nos e-mails de reserva e no tooltip do painel.
 *
 * - Cache em memória (24h para sucesso, 5 min para falha) — o endereço de loja quase nunca muda
 *   e cada e-mail/hover não deve gerar uma chamada nova ao XRS.
 * - Nunca lança exceção: em erro/timeout devolve null e quem chama usa só o código.
 */
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';

export interface StationInfo {
  code: string;
  name: string;
  /** Logradouro (address1 + address2) */
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  /** "Logradouro, CEP Cidade, País" */
  fullAddress: string;
}

const TTL_OK = 24 * 60 * 60 * 1000;
const TTL_FAIL = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: StationInfo | null }>();
const inflight = new Map<string, Promise<StationInfo | null>>();

/** Códigos de estação XRS: 5–8 caracteres alfanuméricos com ao menos um dígito (LISX02, POAO03). */
export function isStationCode(v?: string | null): boolean {
  const s = String(v || '').trim().toUpperCase();
  return /^[A-Z0-9]{5,8}$/.test(s) && /\d/.test(s);
}

const clean = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim();

function buildPhone(a: any): string {
  if (a.phoneWithInternationalDialling) return clean(a.phoneWithInternationalDialling);
  return [a.phoneCountryCode ? `+${a.phoneCountryCode}` : '', a.phoneAreaCode, a.phoneNumber].map(clean).filter(Boolean).join(' ');
}

async function fetchStation(code: string): Promise<StationInfo | null> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getStation">
    <serviceContext>
      <localisation active="true">
        <language code="pt_BR"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <station stationCode="${escapeXml(code)}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

  const res = await callXRS(xml, {
    callerCode: process.env.XRS_CALLER_CODE || '',
    password: process.env.XRS_PASSWORD || '',
    action: 'getStation',
    sourceFile: 'stationInfo.ts',
  });
  const raw = res?.message?.serviceResponse?.station || res?.serviceResponse?.station;
  if (!raw) return null;
  const a = raw.$ || raw;

  const address = [a.address1, a.address2, a.address3].map(clean).filter(Boolean).join(', ');
  const city = clean(a.cityName ?? a.city);
  const postalCode = clean(a.postalCode);
  const country = clean(a.countryName ?? a.countryCode);
  const cityLine = [postalCode, city].filter(Boolean).join(' ');

  return {
    code,
    name: clean(a.stationName) || code,
    address,
    city,
    postalCode,
    country,
    phone: buildPhone(a),
    fullAddress: [address, cityLine, country].filter(Boolean).join(', '),
  };
}

/** Busca (com cache) as informações da loja. `timeoutMs` limita a espera de quem chama. */
export async function getStationInfo(rawCode?: string | null, timeoutMs = 5000): Promise<StationInfo | null> {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!isStationCode(code)) return null;

  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < (hit.data ? TTL_OK : TTL_FAIL)) return hit.data;

  let p = inflight.get(code);
  if (!p) {
    p = fetchStation(code)
      .catch((err) => {
        console.warn(`[stationInfo] Falha ao consultar ${code}:`, err?.message);
        return null;
      })
      .then((data) => {
        cache.set(code, { at: Date.now(), data });
        inflight.delete(code);
        return data;
      });
    inflight.set(code, p);
  }

  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
}

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "CORROIOS SEIXAL (LISX02) — Estação Ferroviária Corroios, 2855-097 Corroios, Portugal" */
export function formatStationLine(code: string, info: StationInfo | null): string {
  if (!info) return code;
  const head = info.name && info.name !== code ? `${info.name} (${code})` : code;
  return info.fullAddress ? `${head} — ${info.fullAddress}` : head;
}

/**
 * Variáveis de loja dos e-mails (retirada e devolução). Valores já escapados para HTML.
 * LOCAL_RETIRADA / LOCAL_DEVOLUCAO passam a trazer nome + código + endereço em texto simples,
 * então até os templates antigos (que só usam {{LOCAL_RETIRADA}}) mostram a loja completa.
 */
export async function buildStationEmailVars(pickupCode?: string | null, returnCode?: string | null): Promise<Record<string, string>> {
  const pCode = String(pickupCode || '').trim().toUpperCase();
  const rCode = String(returnCode || pickupCode || '').trim().toUpperCase();
  const [p, r] = await Promise.all([getStationInfo(pCode), rCode === pCode ? null : getStationInfo(rCode)]);
  const rInfo = rCode === pCode ? p : r;

  const block = (suffix: string, code: string, info: StationInfo | null): Record<string, string> => ({
    [`CODIGO_LOJA_${suffix}`]: escHtml(code),
    [`NOME_LOJA_${suffix}`]: escHtml(info?.name || code),
    [`ENDERECO_LOJA_${suffix}`]: escHtml(info?.fullAddress || ''),
    [`TELEFONE_LOJA_${suffix}`]: escHtml(info?.phone || ''),
    [`LOCAL_${suffix}`]: escHtml(formatStationLine(code, info)),
  });

  return {
    ...(pCode ? block('RETIRADA', pCode, p) : {}),
    ...(rCode ? block('DEVOLUCAO', rCode, rInfo) : {}),
  };
}
