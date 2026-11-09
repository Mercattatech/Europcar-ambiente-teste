import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const MARGIN_KEY = 'eto_margin_percent';
const ZERO_MARGIN_KEY = 'eto_zero_excess_margin_percent';

const ADMIN_EMAILS = [
  "grupomercatta@gmail.com",
  "matheus@grupomercatta.com.br",
  "matheusconti@gmail.com",
  "matheus@grupomercatta.com",
  "admin@mercatta.com.br"
];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedCountry = (searchParams.get('country') || '').toUpperCase().trim();

    // Busca todas as chaves de margem cadastradas
    const blocks = await prisma.contentBlock.findMany({
      where: {
        key: {
          in: [
            MARGIN_KEY,
            ZERO_MARGIN_KEY,
            `${MARGIN_KEY}_PT`,
            `${ZERO_MARGIN_KEY}_PT`,
            `${MARGIN_KEY}_IT`,
            `${ZERO_MARGIN_KEY}_IT`,
          ]
        }
      }
    });

    const blockMap = new Map(blocks.map(b => [b.key, b.value_ptBR]));

    // Global
    const rawGlobal = parseFloat(blockMap.get(MARGIN_KEY) || '0');
    const globalPercent = isNaN(rawGlobal) || rawGlobal < 0 ? 0 : rawGlobal;
    const rawZeroGlobal = blockMap.has(ZERO_MARGIN_KEY) ? parseFloat(blockMap.get(ZERO_MARGIN_KEY) || '') : NaN;
    const globalZeroPercent = isNaN(rawZeroGlobal) || rawZeroGlobal < 0 ? globalPercent : rawZeroGlobal;

    // Portugal (PT)
    const rawPt = blockMap.has(`${MARGIN_KEY}_PT`) ? parseFloat(blockMap.get(`${MARGIN_KEY}_PT`) || '') : NaN;
    const ptPercent = isNaN(rawPt) || rawPt < 0 ? null : rawPt;
    const rawZeroPt = blockMap.has(`${ZERO_MARGIN_KEY}_PT`) ? parseFloat(blockMap.get(`${ZERO_MARGIN_KEY}_PT`) || '') : NaN;
    const ptZeroPercent = isNaN(rawZeroPt) || rawZeroPt < 0 ? null : rawZeroPt;

    // Itália (IT)
    const rawIt = blockMap.has(`${MARGIN_KEY}_IT`) ? parseFloat(blockMap.get(`${MARGIN_KEY}_IT`) || '') : NaN;
    const itPercent = isNaN(rawIt) || rawIt < 0 ? null : rawIt;
    const rawZeroIt = blockMap.has(`${ZERO_MARGIN_KEY}_IT`) ? parseFloat(blockMap.get(`${ZERO_MARGIN_KEY}_IT`) || '') : NaN;
    const itZeroPercent = isNaN(rawZeroIt) || rawZeroIt < 0 ? null : rawZeroIt;

    // Determina a margem efetiva caso um país específico tenha sido solicitado
    let effectivePercent = globalPercent;
    let effectiveZeroPercent = globalZeroPercent;

    if (requestedCountry === 'PT') {
      if (ptPercent !== null) effectivePercent = ptPercent;
      if (ptZeroPercent !== null) effectiveZeroPercent = ptZeroPercent;
    } else if (requestedCountry === 'IT') {
      if (itPercent !== null) effectivePercent = itPercent;
      if (itZeroPercent !== null) effectiveZeroPercent = itZeroPercent;
    }

    return NextResponse.json({
      percent: effectivePercent,
      zeroExcessPercent: effectiveZeroPercent,
      global: {
        percent: globalPercent,
        zeroExcessPercent: globalZeroPercent,
      },
      countries: {
        PT: {
          percent: ptPercent !== null ? ptPercent : globalPercent,
          zeroExcessPercent: ptZeroPercent !== null ? ptZeroPercent : globalZeroPercent,
          custom: ptPercent !== null || ptZeroPtPercentNotNull(ptZeroPercent),
          savedPercent: ptPercent,
          savedZeroExcessPercent: ptZeroPercent,
        },
        IT: {
          percent: itPercent !== null ? itPercent : globalPercent,
          zeroExcessPercent: itZeroPercent !== null ? itZeroPercent : globalZeroPercent,
          custom: itPercent !== null || ptZeroPtPercentNotNull(itZeroPercent),
          savedPercent: itPercent,
          savedZeroExcessPercent: itZeroPercent,
        }
      }
    }, { headers: NO_STORE });
  } catch (error: any) {
    console.error('[margin] DB error, margem indisponível:', error.message);
    return NextResponse.json({ error: 'Margem indisponível' }, { status: 503, headers: NO_STORE });
  }
}

function ptZeroPtPercentNotNull(val: number | null): boolean {
  return val !== null;
}

// POST — admin only
export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { country, percent, zeroExcessPercent } = await request.json();
    const c = (country || 'GLOBAL').toUpperCase().trim();

    let marginKey = MARGIN_KEY;
    let zeroMarginKey = ZERO_MARGIN_KEY;

    if (c === 'PT') {
      marginKey = `${MARGIN_KEY}_PT`;
      zeroMarginKey = `${ZERO_MARGIN_KEY}_PT`;
    } else if (c === 'IT') {
      marginKey = `${MARGIN_KEY}_IT`;
      zeroMarginKey = `${ZERO_MARGIN_KEY}_IT`;
    }

    let savedPercent: number | undefined;
    if (percent !== undefined) {
      savedPercent = Math.max(0, parseFloat(percent) || 0);
      await prisma.contentBlock.upsert({
        where: { key: marginKey },
        update: { value_ptBR: String(savedPercent) },
        create: { key: marginKey, value_ptBR: String(savedPercent) },
      });
    }

    let savedZeroPercent: number | undefined;
    if (zeroExcessPercent !== undefined) {
      savedZeroPercent = Math.max(0, parseFloat(zeroExcessPercent) || 0);
      await prisma.contentBlock.upsert({
        where: { key: zeroMarginKey },
        update: { value_ptBR: String(savedZeroPercent) },
        create: { key: zeroMarginKey, value_ptBR: String(savedZeroPercent) },
      });
    }

    return NextResponse.json({
      success: true,
      country: c,
      percent: savedPercent,
      zeroExcessPercent: savedZeroPercent
    });
  } catch (error: any) {
    console.error('[margin] Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar margem' }, { status: 500 });
  }
}
