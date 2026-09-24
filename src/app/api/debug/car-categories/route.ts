import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

// ENDPOINT DE DEBUG — somente admin
export async function GET(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const station = searchParams.get('station') || 'LIST01';

  const config = {
    callerCode: process.env.XRS_CALLER_CODE || '',
    password: process.env.XRS_PASSWORD || '',
    action: 'getCarCategories',
    sourceFile: 'debug/car-categories',
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceContext language="pt_PT"/>
    <serviceParameters>
      <reservation>
        <checkout stationID="${station}" date="20261120" time="1000"/>
        <checkin stationID="${station}" date="20261125" time="1000"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

  try {
    const resp = await callXRS(xml, config);
    const catList =
      resp?.message?.serviceResponse?.carCategoryList?.carCategory ||
      resp?.serviceResponse?.carCategoryList?.carCategory || [];
    const cats = Array.isArray(catList) ? catList : [catList];
    const result = cats.map((c: any) => {
      const a = c.$ || c;
      return {
        code: a.carCategoryCode,
        name: a.carCategoryName,
        statusCode: a.statusCode || null,
        available: a.available,
      };
    });
    return NextResponse.json({ station, total: result.length, categories: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
