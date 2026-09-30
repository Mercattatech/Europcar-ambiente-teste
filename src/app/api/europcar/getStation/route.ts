import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stationCode = (searchParams.get('code') ?? '').trim().toUpperCase();

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
      type:         attrs.prestige === 'Y' || areaType === 'T' ? 'airport' : 'city',
      leadTime:     attrs.leadTime      ?? '',
      hours,
      has247Return,
      hasOutOfHours,
      hasElectricVehicles,
      features: {
        has247Return,
        hasOutOfHours,
        hasElectricVehicles,
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

// Order: Segunda a Domingo (standard Brazilian business week display)
const DAY_ORDER = [
  { dayNumber: 2, day: 'Seg' },
  { dayNumber: 3, day: 'Ter' },
  { dayNumber: 4, day: 'Qua' },
  { dayNumber: 5, day: 'Qui' },
  { dayNumber: 6, day: 'Sex' },
  { dayNumber: 7, day: 'Sáb' },
  { dayNumber: 1, day: 'Dom' },
];

/**
 * Parses schedule from XRS getStationSchedule response (<stationDaySched> items).
 */
function parseStationSchedule(
  schedItems: any[]
): { day: string; dayNumber: number; open: string; close: string; isClosed: boolean }[] {
  if (!schedItems || !schedItems.length) return [];

  const generalScheds = schedItems.filter(s => {
    const type = (s?.$?.schedType ?? s?.schedType ?? 'G').toUpperCase();
    return type === 'G';
  });

  if (!generalScheds.length) return [];

  return DAY_ORDER.map(({ dayNumber, day }) => {
    const dayMatches = generalScheds.filter(s => {
      const d = parseInt(s?.$?.dayNumber ?? s?.dayNumber ?? 0, 10);
      return d === dayNumber;
    });

    // Prefer regular hours over after-hours item
    const regular = dayMatches.find(s => (s?.$?.afterHours ?? s?.afterHours) !== 'Y');
    const item = regular || dayMatches[0];

    if (!item) {
      return { day, dayNumber, open: '', close: '', isClosed: true };
    }

    const a = item.$ || item;
    const isClosed = a.desc === 'CLOSED' || (!a.timeBegin && !a.timeEnd);
    const open = formatTime(a.timeBegin || '');
    const close = formatTime(a.timeEnd || '');

    return {
      day,
      dayNumber,
      open: isClosed ? '' : open,
      close: isClosed ? '' : close,
      isClosed,
    };
  });
}

/**
 * Fallback parser for older or alternative XRS opening hours structures.
 */
function parseOpeningHours(raw: any): { day: string; dayNumber: number; open: string; close: string; isClosed: boolean }[] {
  const result: { day: string; dayNumber: number; open: string; close: string; isClosed: boolean }[] = [];

  // Structure A: <openingHoursList><openingHours day="MON" openTime="08:00" closeTime="20:00"/>
  const listA = raw?.openingHoursList?.openingHours;
  if (listA) {
    const arr = Array.isArray(listA) ? listA : [listA];
    for (const h of arr) {
      const a = h.$ || h;
      if (a.day || a.openTime) {
        const open = formatTime(a.openTime ?? a.open ?? '');
        const close = formatTime(a.closeTime ?? a.close ?? '');
        const isClosed = !open || open === close || open === '00:00' && close === '00:00';
        result.push({
          day:       translateDay(a.day ?? a.dayOfWeek ?? ''),
          dayNumber: getDayNumber(a.day ?? a.dayOfWeek ?? ''),
          open:      isClosed ? '' : open,
          close:     isClosed ? '' : close,
          isClosed,
        });
      }
    }
    if (result.length) return result;
  }

  // Structure B: <scheduleList><schedule dayOfWeek="1" openTime="..." closeTime="..."/>
  const listB = raw?.scheduleList?.schedule;
  if (listB) {
    const arr = Array.isArray(listB) ? listB : [listB];
    for (const h of arr) {
      const a = h.$ || h;
      const open = formatTime(a.openTime ?? a.open ?? '');
      const close = formatTime(a.closeTime ?? a.close ?? '');
      const isClosed = !open || open === close;
      result.push({
        day:       translateDayNumber(String(a.dayOfWeek ?? a.day ?? '')),
        dayNumber: parseInt(a.dayOfWeek ?? a.day ?? 0, 10),
        open:      isClosed ? '' : open,
        close:     isClosed ? '' : close,
        isClosed,
      });
    }
    if (result.length) return result;
  }

  return result;
}

const DAY_MAP: Record<string, string> = {
  MON: 'Seg', TUE: 'Ter', WED: 'Qua', THU: 'Qui',
  FRI: 'Sex', SAT: 'Sáb', SUN: 'Dom',
  MONDAY: 'Seg', TUESDAY: 'Ter', WEDNESDAY: 'Qua', THURSDAY: 'Qui',
  FRIDAY: 'Sex', SATURDAY: 'Sáb', SUNDAY: 'Dom',
};

const DAY_NUM_MAP: Record<string, string> = {
  '1': 'Dom', '2': 'Seg', '3': 'Ter', '4': 'Qua',
  '5': 'Qui', '6': 'Sex', '7': 'Sáb',
};

function translateDay(d: string): string {
  return DAY_MAP[d.toUpperCase()] ?? d;
}

function translateDayNumber(n: string): string {
  return DAY_NUM_MAP[n] ?? n;
}

function getDayNumber(d: string): number {
  const map: Record<string, number> = {
    MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7, SUN: 1,
    MONDAY: 2, TUESDAY: 3, WEDNESDAY: 4, THURSDAY: 5, FRIDAY: 6, SATURDAY: 7, SUNDAY: 1,
  };
  return map[d.toUpperCase()] ?? 0;
}

function formatTime(t: string): string {
  if (!t) return '';
  const clean = t.replace(':', '');
  if (clean.length === 4) return `${clean.slice(0, 2)}:${clean.slice(2)}`;
  if (clean.length === 3) return `0${clean.slice(0, 1)}:${clean.slice(1)}`;
  return t;
}
