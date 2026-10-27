import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkAdmin } from "@/lib/checkAdmin";
export const dynamic = 'force-dynamic';

const DEFAULT_XRS_CONFIG = {
  poaCid: '57269673',
  poaIata: '02170722',
  etoZeroExcessCid: '56935495',
  etoZeroExcessBa: '73804373',
  etoExcessCid: '56935466',
  etoExcessBa: '73675595',
  exoCid: '57269673',
  exoIata: '02170722',
  callerCode: process.env.XRS_CALLER_CODE || '',
  password: process.env.XRS_PASSWORD || '',
};

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let cbIata: string | undefined;
    try {
      const cb = await prisma.contentBlock.findUnique({ where: { key: 'XRS_POA_IATA' } });
      if (cb?.value_ptBR) cbIata = cb.value_ptBR.trim();
    } catch {}

    const config = await prisma.xRSConfig.findFirst() as any;
    if (!config) {
      return NextResponse.json({
        ...DEFAULT_XRS_CONFIG,
        poaIata: cbIata || DEFAULT_XRS_CONFIG.poaIata,
      });
    }
    return NextResponse.json({
      callerCode: config.callerCode || DEFAULT_XRS_CONFIG.callerCode,
      password: config.password || DEFAULT_XRS_CONFIG.password,
      poaCid: config.poaCid || DEFAULT_XRS_CONFIG.poaCid,
      poaIata: cbIata || config.poaIata || DEFAULT_XRS_CONFIG.poaIata,
      etoZeroExcessCid: config.etoZeroExcessCid || DEFAULT_XRS_CONFIG.etoZeroExcessCid,
      etoZeroExcessBa: config.etoZeroExcessBa || DEFAULT_XRS_CONFIG.etoZeroExcessBa,
      etoExcessCid: config.etoExcessCid || DEFAULT_XRS_CONFIG.etoExcessCid,
      etoExcessBa: config.etoExcessBa || DEFAULT_XRS_CONFIG.etoExcessBa,
      exoCid: config.exoCid || DEFAULT_XRS_CONFIG.exoCid,
      exoIata: config.exoIata || DEFAULT_XRS_CONFIG.exoIata,
    });
  } catch (error: any) {
    console.warn('[XRSConfig GET] Fallback para padroes:', error?.message);
    return NextResponse.json(DEFAULT_XRS_CONFIG);
  }
}

export async function POST(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

    const poaCid = trim(body.poaCid) || DEFAULT_XRS_CONFIG.poaCid;
    const poaIata = trim(body.poaIata) || DEFAULT_XRS_CONFIG.poaIata;
    const etoZeroExcessCid = trim(body.etoZeroExcessCid) || DEFAULT_XRS_CONFIG.etoZeroExcessCid;
    const etoZeroExcessBa = trim(body.etoZeroExcessBa) || DEFAULT_XRS_CONFIG.etoZeroExcessBa;
    const etoExcessCid = trim(body.etoExcessCid) || DEFAULT_XRS_CONFIG.etoExcessCid;
    const etoExcessBa = trim(body.etoExcessBa) || DEFAULT_XRS_CONFIG.etoExcessBa;
    const exoCid = trim(body.exoCid) || DEFAULT_XRS_CONFIG.exoCid;
    const exoIata = trim(body.exoIata) || DEFAULT_XRS_CONFIG.exoIata;
    const callerCode = trim(body.callerCode) || DEFAULT_XRS_CONFIG.callerCode;
    const password = trim(body.password) || DEFAULT_XRS_CONFIG.password;

    // Salva sempre no ContentBlock como garantia imediata
    try {
      await prisma.contentBlock.upsert({
        where: { key: 'XRS_POA_IATA' },
        update: { value_ptBR: String(poaIata) },
        create: { key: 'XRS_POA_IATA', value_ptBR: String(poaIata) },
      });
    } catch (cbErr: any) {
      console.warn('[XRSConfig POST] ContentBlock save error:', cbErr?.message);
    }

    const existing = await prisma.xRSConfig.findFirst({ select: { id: true } });

    const data: any = {
      callerCode,
      password,
      poaCid,
      poaIata,
      etoZeroExcessCid,
      etoZeroExcessBa,
      etoExcessCid,
      etoExcessBa,
      exoCid,
      exoIata,
    };

    let config: any;
    try {
      config = existing?.id
        ? await prisma.xRSConfig.update({ where: { id: existing.id }, data })
        : await prisma.xRSConfig.create({ data });
    } catch (dbErr: any) {
      console.warn('[XRSConfig POST] update sem poaIata direto na tabela (fallback ativo):', dbErr?.message);
      // Se a coluna poaIata ainda não estiver na tabela física, salva sem ela
      delete data.poaIata;
      config = existing?.id
        ? await prisma.xRSConfig.update({ where: { id: existing.id }, data })
        : await prisma.xRSConfig.create({ data });
      config = { ...config, poaIata };
    }

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('[XRSConfig POST] Erro:', error?.message);
    return NextResponse.json({ error: 'Erro ao salvar configuracao: ' + error?.message }, { status: 500 });
  }
}
