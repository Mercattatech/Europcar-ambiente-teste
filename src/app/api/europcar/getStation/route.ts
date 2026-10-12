import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { parseStationSchedule, parseOpeningHours, parseSpecialSchedule } from '@/lib/europcar/scheduleParser';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stationCode = (searchParams.get('code') ?? searchParams.get('stationCode') ?? '').trim().toUpperCase();

  if (!stationCode) {
    return NextResponse.json({ error: 'Parâmetro code é obrigatório.' }, { status: 400 });
  }

  try {
    const xmlStationRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getStation">
    <serviceContext>
      <localisation active="true">
        <language code="pt_BR"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <station stationCode="${escapeXml(stationCode)}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const xmlScheduleRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getStationSchedule">
    <serviceContext>
      <localisation active="true">
        <language code="pt_BR"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <station stationCode="${escapeXml(stationCode)}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    // Fetch station details and opening hours schedule in parallel
    const [stationRes, scheduleRes] = await Promise.all([
      callXRS(xmlStationRequest, {
        callerCode: process.env.XRS_CALLER_CODE || '',
        password: process.env.XRS_PASSWORD || '',
        action: 'getStation',
        sourceFile: 'getStation/route.ts',
      }),
      callXRS(xmlScheduleRequest, {
        callerCode: process.env.XRS_CALLER_CODE || '',
        password: process.env.XRS_PASSWORD || '',
        action: 'getStationSchedule',
        sourceFile: 'getStation/route.ts',
      }).catch(err => {
        console.warn(`[getStation] Falha ao consultar getStationSchedule para ${stationCode}:`, err.message);
        return null;
      }),
    ]);

    // Navigate to station node — XRS may return different structures
    const raw =
      stationRes?.message?.serviceResponse?.station ||
      stationRes?.serviceResponse?.station ||
      null;

    if (!raw) {
      return NextResponse.json({ error: 'Estação não encontrada.' }, { status: 404 });
    }

    // Attributes may live in raw.$ or directly on raw
    const attrs = raw.$ || raw;

    // ── Parse Services from <serviceList> ────────────────────────────────
    let services = raw?.serviceList?.service || [];
    if (!Array.isArray(services)) services = services ? [services] : [];
    const serviceCodes = new Set<string>(
      services
        .map((s: any) => String(s?.$?.code ?? s?.code ?? '').trim().toUpperCase())
        .filter(Boolean)
    );

    // ── Parse Schedule from <openHoursList> ──────────────────────────────
    let schedItems =
      scheduleRes?.message?.serviceResponse?.openHoursList?.stationDaySched ||
      scheduleRes?.serviceResponse?.openHoursList?.stationDaySched ||
      [];
    if (!Array.isArray(schedItems)) schedItems = schedItems ? [schedItems] : [];

    // Check after-hours flag from schedule
    const hasAfterHoursSched = schedItems.some(
      (s: any) => (s?.$?.afterHours ?? s?.afterHours) === 'Y'
    );

    // Dynamic Station Capabilities based on Europcar XRS API
    let has247Return =
      serviceCodes.has('KEYBOX') ||
      serviceCodes.has('KEYDROP') ||
      serviceCodes.has('DROPBOX');

    const hasOutOfHours =
      serviceCodes.has('CIOOH') ||
      serviceCodes.has('OOH') ||
      hasAfterHoursSched;

    const hasElectricVehicles =
      serviceCodes.has('ELECTRIC') ||
      serviceCodes.has('GREENSTN') ||
      serviceCodes.has('EV');

    // hasShuttle: only true for off-terminal stations (areaType='O') that actually have shuttle.
    // TRANSFER is a generic service code most airports have — it does NOT mean shuttle bus.
    // The station is considered to need a shuttle only if it's outside the terminal building.
    const rawAreaType = attrs.areaType || (stationCode.length >= 4 ? (stationCode[3] === 'O' ? 'O' : '') : '');
    const hasShuttle =
      rawAreaType === 'O' && (
        serviceCodes.has('SHUTTLE') ||
        serviceCodes.has('TRANSFER')
      );

    const hasDelivery =
      serviceCodes.has('DELIVERY') ||
      attrs.delivery === 'Y' ||
      attrs.delivery === 'R';

    const hasCollection =
      serviceCodes.has('COLLECTION') ||
      attrs.collection === 'Y' ||
      attrs.collection === 'R';

    const hasMeetAndGreet =
      serviceCodes.has('M&G') ||
      serviceCodes.has('MG') ||
      serviceCodes.has('MEETANDGREET') ||
      attrs.stationName?.toUpperCase().includes('MEET AND GREET') ||
      attrs.stationName?.toUpperCase().includes('M AND G');

    // ── Parse Opening Hours ──────────────────────────────────────────────
    let hours = parseStationSchedule(schedItems);

    // Fallback: If getStationSchedule returned nothing, try openingHours on getStation
    if (!hours.length) {
      hours = parseOpeningHours(raw);
    }

    const hasLunchBreak = hours.some(h => Boolean(h.hasLunchBreak));
    const specialHours = parseSpecialSchedule(schedItems);

    // If station is open 24h every day, also flag has247Return
    const isAlwaysOpen247 =
      hours.length >= 7 &&
      hours.every(h => !h.isClosed && h.open === '00:00' && (h.close === '24:00' || h.close === '23:59'));
    if (isAlwaysOpen247) {
      has247Return = true;
    }

    // Station type detection: areaType 'T' = Terminal (in-airport), 'O' = Off-terminal
    // Fallback: 4th character of station code (per XRS spec)
    const areaType = attrs.areaType || (stationCode.length >= 4 ? (stationCode[3] === 'T' ? 'T' : stationCode[3] === 'O' ? 'O' : '') : '');
    const isTerminal = areaType === 'T';
    const isOffTerminal = areaType === 'O';
    const isRailwayOrCity = areaType === 'C' || areaType === 'L' || areaType === 'X';
    const isAirport =
      !isRailwayOrCity &&
      (isTerminal ||
       isOffTerminal ||
       /\b(airport|aeroporto|aeropuerto|flughafen|aéroport)\b/i.test(attrs.stationName || ''));

    // Delivery/Collection mode: 'Y' = available, 'R' = on request
    const deliveryMode = attrs.delivery || '';  // '', 'Y', 'R'
    const collectionMode = attrs.collection || ''; // '', 'Y', 'R'

    const station = {
      code:         attrs.stationCode   ?? stationCode,
      name:         attrs.stationName   ?? '',
      address:      [attrs.address1, attrs.address2].filter(Boolean).join(', '),
      city:         attrs.cityName      ?? attrs.city ?? '',
      postalCode:   attrs.postalCode    ?? '',
      country:      attrs.countryName   ?? attrs.countryCode ?? '',
      phone:        attrs.phoneWithInternationalDialling ?? buildPhone(attrs),
      email:        sanitizeEmail(attrs.email ?? ''),
      latitude:     attrs.latitude      ?? '',
      longitude:    attrs.longitude     ?? '',
      type:         isAirport ? 'airport' : 'city',
      leadTime:     attrs.leadTime      ?? '',
      hours,
      hasLunchBreak,
      specialHours,
      has247Return,
      hasOutOfHours,
      hasElectricVehicles,
      features: {
        has247Return,
        hasOutOfHours,
        hasElectricVehicles,
        hasLunchBreak,
        hasShuttle,
        hasDelivery,
        hasCollection,
        hasMeetAndGreet,
        serviceCodes: Array.from(serviceCodes),
        areaType,
        isTerminal,
        isOffTerminal,
        deliveryMode,
        collectionMode,
      },
    };

    return NextResponse.json({ station });

  } catch (error: any) {
    console.error(`[getStation] Erro ao consultar ${stationCode}:`, error);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getStation' },
      { status: 500 }
    );
  }
}

function buildPhone(attrs: any): string {
  const parts = [
    attrs.phoneCountryCode ? `+${attrs.phoneCountryCode}` : '',
    attrs.phoneAreaCode ?? '',
    attrs.phoneNumber ?? '',
  ].filter(Boolean);
  return parts.join(' ');
}

function sanitizeEmail(raw: string): string {
  if (!raw) return '';

  const BLOCKED_PATTERNS = [
    /msk\.europcar/i,          // MSK Exchange relay (most common)
    /exchange\./i,             // Generic Exchange relay
    /relay\./i,                // Generic relay
    /noreply/i,                // No-reply addresses
    /no-reply/i,
    /donotreply/i,
    /postmaster/i,
    /mailer-daemon/i,
    /^\s*$/,                   // Empty or whitespace
  ];

  const candidates = raw.split(/[;,]/).map(e => e.trim()).filter(Boolean);

  for (const email of candidates) {
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidFormat) continue;

    const isBlocked = BLOCKED_PATTERNS.some(p => p.test(email));
    if (isBlocked) continue;

    return email;
  }

  return '';
}

