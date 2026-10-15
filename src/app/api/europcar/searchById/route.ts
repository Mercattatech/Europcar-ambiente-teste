import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { checkReservationAccess } from '@/lib/europcar/ownership';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { resNumber: rawResNumber, email } = await request.json();
    const resNumber = String(rawResNumber || '').trim();

    if (!resNumber) {
      return NextResponse.json({ error: 'resNumber é obrigatório' }, { status: 400 });
    }

    // Cliente logado (sessão) OU cliente sem login (nº da reserva + e-mail da compra)
    const session = await getServerSession(authOptions);
    const access = await checkReservationAccess(resNumber, {
      sessionEmail: session?.user?.email,
      guestEmail: email,
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}" />
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'search.searchbyid',
      sourceFile: 'searchById/route.ts',
    };

    const xrsResponse = await callXRS(xmlRequest, config);
    const resNode =
      xrsResponse?.message?.serviceResponse?.reservation ||
      xrsResponse?.serviceResponse?.reservation;

    const attrs = resNode?.$ ?? null;
    const statusCode: string = attrs?.statusCode ?? '';

    // Status codes from XRS spec:
    // S  = Sold, R = On Request (pending), CF = Confirmed, CC = Cancelled,
    // CP = Prepaid Cancelled, CO = Checkout, NS = No Show, TD = Turn Down
    const warningList = resNode?.warningList?.warning ?? null;
    const warnings = Array.isArray(warningList)
      ? warningList.map((w: any) => w.$ || w)
      : warningList
      ? [warningList.$ || warningList]
      : [];

    const onRequestItemList = resNode?.onRequestItemList?.onRequestItem ?? null;
    const onRequestItems = Array.isArray(onRequestItemList)
      ? onRequestItemList.map((i: any) => i.$ || i)
      : onRequestItemList
      ? [onRequestItemList.$ || onRequestItemList]
      : [];

    return NextResponse.json({
      statusCode,
      resNumber: attrs?.resNumber ?? resNumber,
      confirmed: statusCode === 'CF',
      onRequest: statusCode === 'R',
      cancelled: statusCode === 'CC' || statusCode === 'CP',
      warnings,
      onRequestItems,
      raw: xrsResponse,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar reserva XRS' },
      { status: 500 }
    );
  }
}
