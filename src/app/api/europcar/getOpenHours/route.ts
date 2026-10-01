import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { parseStationSchedule, parseSpecialSchedule } from '@/lib/europcar/scheduleParser';
export const dynamic = 'force-dynamic';

function processScheduleResponse(xrsResponse: any, stationCode: string) {
  let schedItems =
    xrsResponse?.message?.serviceResponse?.openHoursList?.stationDaySched ||
    xrsResponse?.serviceResponse?.openHoursList?.stationDaySched ||
    [];
  if (!Array.isArray(schedItems)) schedItems = schedItems ? [schedItems] : [];

  const hours = parseStationSchedule(schedItems);
  const hasLunchBreak = hours.some(h => Boolean(h.hasLunchBreak));
  const specialHours = parseSpecialSchedule(schedItems);

  return {
    ...xrsResponse,
    stationCode,
    hours,
    hasLunchBreak,
    specialHours,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const stationCode = (body.stationCode || body.code || '').trim().toUpperCase();

    if (!stationCode) {
      return NextResponse.json({ error: 'Parâmetro stationCode é obrigatório.' }, { status: 400 });
    }

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
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
</message>`.trim();

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || '',
      password: process.env.XRS_PASSWORD || '',
      action: 'getStationSchedule',
      sourceFile: 'getOpenHours/route.ts',
    };

    const xrsResponse = await callXRS(xmlRequest, config);
    return NextResponse.json(processScheduleResponse(xrsResponse, stationCode));

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getStationSchedule' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stationCode = (searchParams.get('code') || searchParams.get('stationCode') || '').trim().toUpperCase();

    if (!stationCode) {
      return NextResponse.json({ error: 'Parâmetro code é obrigatório.' }, { status: 400 });
    }

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
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
</message>`.trim();

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || '',
      password: process.env.XRS_PASSWORD || '',
      action: 'getStationSchedule',
      sourceFile: 'getOpenHours/route.ts',
    };

    const xrsResponse = await callXRS(xmlRequest, config);
    return NextResponse.json(processScheduleResponse(xrsResponse, stationCode));

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getStationSchedule' },
      { status: 500 }
    );
  }
}
