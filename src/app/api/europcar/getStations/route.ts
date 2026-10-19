import { NextResponse } from 'next/server';
import { getStations } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════
// MICROSITE XML CACHE — Fonte primária de estações (recomendado pela Europcar)
// Reduz chamadas ao XRS getStations de ~4.179 hits para ~1 por 24h.
// Microsite URL: https://microsite.europcar.com/locations/stations_EN.xml
// ═══════════════════════════════════════════════════════════════════════════

interface MicrositeStation {
  stationCode: string;
  stationName: string;
  countryCode: string;
  countryName: string;
  areaType: string;
  cityName: string;
  address1: string;
  address2: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  email: string;
  phoneCountryCode: string;
  phoneAreaCode: string;
  phoneNumber: string;
  delivery: string;
  collection: string;
  flag_prestige: string;
  isTruckAvailable: string;
  leadTime: string;
}

// In-memory cache for microsite data
let micrositeCache: { stations: MicrositeStation[]; ts: number } | null = null;
const MICROSITE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MICROSITE_URL = 'https://microsite.europcar.com/locations/stations_EN.xml';

// Fallback: XRS in-memory cache (old behavior, used if microsite fails)
const xrsFallbackCache: Record<string, { stations: any[]; ts: number }> = {};
const XRS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Parse the microsite XML into structured station objects.
 * Uses regex parsing to avoid xml2js dependency in the API route.
 */
function parseMicrositeXml(xml: string): MicrositeStation[] {
  const stations: MicrositeStation[] = [];
  // Match each <station ... > tag (self-closing or with children)
  const stationRegex = /<station\s+([^>]+)>/g;
  let match;

  while ((match = stationRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const get = (name: string): string => {
      const attrMatch = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return attrMatch ? decodeXmlEntities(attrMatch[1]) : '';
    };

    const stationCode = get('stationCode');
    if (!stationCode) continue;

    stations.push({
      stationCode,
      stationName: get('stationName'),
      countryCode: get('countryCode'),
      countryName: get('countryName'),
      areaType: get('areaType'),
      cityName: get('cityName'),
      address1: get('address1'),
      address2: get('address2'),
      postalCode: get('postalCode'),
      latitude: get('latitude'),
      longitude: get('longitude'),
      email: get('email'),
      phoneCountryCode: get('phoneCountryCode'),
      phoneAreaCode: get('phoneAreaCode'),
      phoneNumber: get('phoneNumber'),
      delivery: get('delivery'),
      collection: get('collection'),
      flag_prestige: get('flag_prestige'),
      isTruckAvailable: get('isTruckAvailable'),
      leadTime: get('leadTime'),
    });
  }

  return stations;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Fetch and cache all stations from the Europcar microsite XML.
 * This is the primary source — replaces per-country XRS getStations calls.
 */
async function getMicrositeStations(): Promise<MicrositeStation[]> {
  // Return cached data if fresh
  if (micrositeCache && Date.now() - micrositeCache.ts < MICROSITE_CACHE_TTL_MS) {
    return micrositeCache.stations;
  }

  try {
    console.log('[getStations] 🌐 Fetching microsite XML (primary source)...');
    const response = await fetch(MICROSITE_URL, {
      signal: AbortSignal.timeout(15000), // 15s timeout
      headers: { 'Accept': 'application/xml, text/xml' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const stations = parseMicrositeXml(xml);

    if (stations.length < 100) {
      // Sanity check — microsite should have thousands of stations
      throw new Error(`Only ${stations.length} stations parsed — likely corrupt XML`);
    }

    micrositeCache = { stations, ts: Date.now() };
    console.log(`[getStations] ✅ Microsite cache loaded: ${stations.length} stations worldwide`);
    return stations;
  } catch (err: any) {
    console.warn(`[getStations] ⚠️ Microsite fetch failed: ${err.message} — using fallback`);
    // Return stale cache if available
    if (micrositeCache) return micrositeCache.stations;
    return [];
  }
}

/**
 * XRS fallback: Fetch stations for a single country (old behavior).
 * Only used when microsite is unavailable.
 */
async function getXRSFallbackStations(countryCode: string): Promise<any[]> {
  const cached = xrsFallbackCache[countryCode];
  if (cached && Date.now() - cached.ts < XRS_CACHE_TTL_MS) {
    return cached.stations;
  }

  try {
    const stations = await getStations(countryCode);
    const tagged = stations.map(s => ({ ...s, countryCode }));
    xrsFallbackCache[countryCode] = { stations: tagged, ts: Date.now() };
    return tagged;
  } catch (e) {
    console.error(`[getStations] XRS fallback failed for ${countryCode}:`, e);
    return cached?.stations || [];
  }
}

// Country name lookup for display
const COUNTRY_NAMES: Record<string, string> = {
  BR: 'Brasil', AR: 'Argentina', US: 'Estados Unidos', CA: 'Canadá', MX: 'México',
  FR: 'França', DE: 'Alemanha', ES: 'Espanha', IT: 'Itália', GB: 'Reino Unido',
  PT: 'Portugal', BE: 'Bélgica', NL: 'Países Baixos', CH: 'Suíça', AT: 'Áustria',
  IE: 'Irlanda', GR: 'Grécia', HR: 'Croácia', CZ: 'Rep. Checa', DK: 'Dinamarca',
  FI: 'Finlândia', HU: 'Hungria', NO: 'Noruega', PL: 'Polônia', RO: 'Romênia',
  SE: 'Suécia', TR: 'Turquia', BG: 'Bulgária', IS: 'Islândia', AU: 'Austrália',
  NZ: 'Nova Zelândia', AE: 'Emirados Árabes', MA: 'Marrocos', ZA: 'África do Sul',
  JP: 'Japão', TH: 'Tailândia', IL: 'Israel', CL: 'Chile', CO: 'Colômbia',
  PE: 'Peru', UY: 'Uruguai',
};

const SYNONYMS: Record<string, string[]> = {
  'roma': ['rome'], 'rome': ['roma'],
  'milano': ['milan'], 'milan': ['milano'],
  'firenze': ['florence'], 'florence': ['firenze'],
  'napoli': ['naples'], 'naples': ['napoli'],
  'venezia': ['venice'], 'venice': ['venezia'],
  'torino': ['turin'], 'turin': ['torino'],
  'londres': ['london'], 'london': ['londres'],
  'lisboa': ['lisbon'], 'lisbon': ['lisboa'],
  'munich': ['munchen'], 'munchen': ['munich'],
  'bruxelas': ['brussels', 'bruxelles'], 'brussels': ['bruxelas', 'bruxelles'], 'bruxelles': ['bruxelas', 'brussels'],
  'zurique': ['zurich'], 'zurich': ['zurique'],
  'genebra': ['geneva'], 'geneva': ['genebra'],
  'viena': ['vienna'], 'vienna': ['viena'],
  'atenas': ['athens'], 'athens': ['atenas'],
  'praga': ['prague'], 'prague': ['praga'],
  'copenhague': ['copenhagen'], 'copenhagen': ['copenhague'],
  'budapeste': ['budapest'], 'budapest': ['budapeste'],
  'varsovia': ['warsaw'], 'warsaw': ['varsovia'],
  'cracovia': ['krakow'], 'krakow': ['cracovia'],
  'bucareste': ['bucharest'], 'bucharest': ['bucareste'],
  'estocolmo': ['stockholm'], 'stockholm': ['estocolmo'],
  'istambul': ['istanbul'], 'istanbul': ['istambul'],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const countryParam = searchParams.get('country')?.toUpperCase();

  if (!q || q.length < 2) {
    return NextResponse.json({ stations: [] });
  }

  // ── Try microsite (primary source) ──────────────────────────────────────
  let allStations: any[] = [];
  const micrositeData = await getMicrositeStations();

  if (micrositeData.length > 0) {
    // Map microsite data to our internal format
    allStations = micrositeData.map(s => ({
      stationCode: s.stationCode,
      stationName: s.stationName,
      cityName: s.cityName,
      countryCode: s.countryCode,
      countryName: s.countryName,
      prestige: s.flag_prestige,
      address1: s.address1,
      address2: s.address2,
      postalCode: s.postalCode,
      latitude: s.latitude,
      longitude: s.longitude,
      truckAvailable: s.isTruckAvailable,
      email: s.email,
      leadTime: s.leadTime,
    }));

    // Filter by country if specified
    if (countryParam && countryParam !== 'ALL') {
      allStations = allStations.filter(s => s.countryCode === countryParam);
    }
  } else {
    // ── XRS Fallback (only if microsite is unavailable) ────────────────────
    console.warn('[getStations] ⚠️ Microsite unavailable — falling back to XRS');
    if (countryParam && countryParam !== 'ALL') {
      allStations = await getXRSFallbackStations(countryParam);
    } else {
      // Fetch Brazil + try to find matching country
      allStations = await getXRSFallbackStations('BR');
    }
  }

  // Deduplicate by station code
  const seenCodes = new Set<string>();
  const uniqueStations = allStations.filter((s) => {
    const code = (s.stationCode ?? s.code ?? '').toUpperCase();
    if (!code || seenCodes.has(code)) return false;
    seenCodes.add(code);
    return true;
  });

  // Helper to match term at the beginning of any word
  const matchWordStart = (text: string, term: string): boolean => {
    const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}]+)${escaped}`, 'ui');
    return regex.test(text);
  };

  // Apply text filter
  const searchTerms = [q, ...(SYNONYMS[q] || [])];
  const filtered = uniqueStations.filter((s) => {
    const code = s.stationCode ?? s.code ?? '';
    const name = s.stationName ?? s.name ?? '';
    const city = s.cityName ?? s.city ?? '';
    const country = COUNTRY_NAMES[s.countryCode] ?? s.countryName ?? s.countryCode ?? '';
    return searchTerms.some(term =>
      matchWordStart(code, term) ||
      matchWordStart(name, term) ||
      matchWordStart(city, term) ||
      matchWordStart(country, term)
    );
  });

  // Sort: exact city match first, then station name match, then others
  filtered.sort((a, b) => {
    const cityA = (a.cityName ?? a.city ?? '').toLowerCase();
    const cityB = (b.cityName ?? b.city ?? '').toLowerCase();
    const nameA = (a.stationName ?? a.name ?? '').toLowerCase();
    const nameB = (b.stationName ?? b.name ?? '').toLowerCase();

    // Exact city match gets priority
    const aCityExact = searchTerms.some(term => cityA === term) ? 0 : searchTerms.some(term => cityA.startsWith(term)) ? 1 : 2;
    const bCityExact = searchTerms.some(term => cityB === term) ? 0 : searchTerms.some(term => cityB.startsWith(term)) ? 1 : 2;
    if (aCityExact !== bCityExact) return aCityExact - bCityExact;

    // Then station name match
    const aNameMatch = searchTerms.some(term => nameA.includes(term)) ? 0 : 1;
    const bNameMatch = searchTerms.some(term => nameB.includes(term)) ? 0 : 1;
    if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;

    return nameA.localeCompare(nameB);
  });

  // Limit results for performance
  const limited = filtered.slice(0, 30);

  // Shape payload for frontend autocomplete
  const payload = limited.map((s) => {
    const code = String(s.stationCode ?? s.code ?? '').toUpperCase();
    const name = s.stationName ?? s.name ?? '';
    const areaType = String(s.areaType ?? '').toUpperCase();

    // Regra XRS Europcar para identificação de aeroporto:
    // - areaType="T" (Terminal de aeroporto) ou "O" (Off-terminal com transfer/shuttle de aeroporto)
    // - Ou 4º caractere do código "T" ou "O" (ex: LIST01, CDGT01) exceto se for explicitamente cidade/trem (C, L, X)
    // - Ou nome contendo termos específicos de aeroporto
    const isRailwayOrCity = areaType === 'C' || areaType === 'L' || areaType === 'X';
    const isAirport =
      !isRailwayOrCity &&
      (areaType === 'T' ||
       areaType === 'O' ||
       (code.length >= 4 && (code[3] === 'T' || code[3] === 'O')) ||
       /\b(airport|aeroporto|aeropuerto|flughafen|aéroport)\b/i.test(name));

    const fullAddress = [s.address1, s.address2, s.postalCode].map(x => (x || '').trim()).filter(Boolean).join(', ');
    return {
      code,
      name,
      city: s.cityName ?? s.city ?? '',
      country: COUNTRY_NAMES[s.countryCode] ?? s.countryName ?? s.countryCode ?? '',
      countryCode: s.countryCode ?? '',
      type: isAirport ? 'airport' : 'city',
      address: fullAddress || s.address1 || s.address || '',
      features: s.features ?? [],
      hours: s.hours ?? [],
    };
  });

  return NextResponse.json({ stations: payload });
}
