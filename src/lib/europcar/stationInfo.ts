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

/** Códigos de estação XRS: 3–10 caracteres alfanuméricos. */
export function isStationCode(v?: string | null): boolean {
  if (!v) return false;
  const s = String(v).trim().toUpperCase();
  return /^[A-Z0-9]{3,10}$/.test(s);
}

/** Extrai código da estação mesmo se estiver com parênteses, hífen ou texto livre. */
export function extractStationCode(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim().toUpperCase();
  if (/^[A-Z0-9]{3,10}$/.test(s)) return s;
  const mParen = s.match(/\(([A-Z0-9]{3,10})\)/);
  if (mParen) return mParen[1];
  const mWord = s.match(/\b([A-Z]{2,4}\d{1,4}[A-Z0-9]*|[A-Z]{3,4}[A-Z0-9]{1,4}\d[A-Z0-9]*)\b/);
  if (mWord) return mWord[1];
  const mFirst = s.match(/^([A-Z0-9]{3,10})\b/);
  if (mFirst) return mFirst[1];
  return null;
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
  const code = extractStationCode(rawCode) || String(rawCode || '').trim().toUpperCase();
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

export interface StationFallbacks {
  pickupName?: string | null;
  returnName?: string | null;
  pickupAddress?: string | null;
  returnAddress?: string | null;
  pickupPhone?: string | null;
  returnPhone?: string | null;
}

/** "CORROIOS SEIXAL (LISX02) — Estação Ferroviária Corroios, 2855-097 Corroios, Portugal" */
export function formatStationLine(
  code: string,
  info: StationInfo | null,
  fallbackAddress?: string | null,
  fallbackName?: string | null
): string {
  const name = info?.name && info.name !== code ? info.name : (fallbackName && fallbackName !== code ? fallbackName : code);
  const head = name !== code ? `${name} (${code})` : code;
  const address = info?.fullAddress || fallbackAddress || '';
  return address ? `${head} — ${address}` : head;
}

/**
 * Variáveis de loja dos e-mails (retirada e devolução). Valores já escapados para HTML.
 * Garante sempre CODIGO, NOME, ENDERECO e TELEFONE de cada loja.
 * LOCAL_RETIRADA / LOCAL_DEVOLUCAO trazem nome + código + endereço completo.
 */
export async function buildStationEmailVars(
  pickupCode?: string | null,
  returnCode?: string | null,
  fallbacks?: StationFallbacks
): Promise<Record<string, string>> {
  const pCode = extractStationCode(pickupCode) || String(pickupCode || '').trim().toUpperCase();
  const rCode = extractStationCode(returnCode || pickupCode) || String(returnCode || pickupCode || '').trim().toUpperCase();
  const isSame = !rCode || rCode === pCode;

  const [p, r] = await Promise.all([
    pCode ? getStationInfo(pCode) : null,
    isSame ? null : (rCode ? getStationInfo(rCode) : null),
  ]);
  const rInfo = isSame ? p : r;

  const pAddress = p?.fullAddress || fallbacks?.pickupAddress || '';
  const rAddress = rInfo?.fullAddress || fallbacks?.returnAddress || (isSame ? pAddress : '');
  const pName = p?.name || fallbacks?.pickupName || pCode;
  const rName = rInfo?.name || fallbacks?.returnName || (isSame ? pName : rCode);
  const pPhone = p?.phone || fallbacks?.pickupPhone || '';
  const rPhone = rInfo?.phone || fallbacks?.returnPhone || (isSame ? pPhone : '');

  const block = (
    suffix: string,
    code: string,
    info: StationInfo | null,
    finalName: string,
    finalAddress: string,
    finalPhone: string
  ): Record<string, string> => ({
    [`CODIGO_LOJA_${suffix}`]: escHtml(code),
    [`NOME_LOJA_${suffix}`]: escHtml(finalName),
    [`ENDERECO_LOJA_${suffix}`]: escHtml(finalAddress),
    [`TELEFONE_LOJA_${suffix}`]: escHtml(finalPhone),
    [`LOCAL_${suffix}`]: escHtml(formatStationLine(code, info, finalAddress, finalName)),
  });

  return {
    ...(pCode ? block('RETIRADA', pCode, p, pName, pAddress, pPhone) : {}),
    ...(rCode ? block('DEVOLUCAO', rCode, rInfo, rName, rAddress, rPhone) : {}),
  };
}
