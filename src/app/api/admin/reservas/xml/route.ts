import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/checkAdmin';
import prisma from '@/lib/prisma';
import { getReservationRawXml } from '@/lib/europcar/xrsClient';

export const dynamic = 'force-dynamic';

/**
 * Ações XRS que efetivamente referenciam uma reserva específica.
 * Restringir a busca a elas evita varrer os milhares de logs gigantes de
 * getMultipleRates / getCarCategories / getStation (causa da lentidão).
 */
const RESERVATION_ACTIONS = [
  'bookReservation',
  'modifyReservation',
  'cancelReservation',
  'search.searchbyid',
  'readBooking',
  'createDriver',
  'createVoucher',
];

/** Janela de busca no histórico (dias). */
const LOG_WINDOW_DAYS = 180;

/**
 * POST /api/admin/reservas/xml
 *
 * Body: { resNumber?, merchantOrderId?, mode?: 'logs' | 'live' | 'both' }
 *  - 'logs' → só histórico do LogXRS (rápido)
 *  - 'live' → só consulta ao vivo no GreenWay (search.searchbyid)
 *  - 'both' → ambos em paralelo (padrão, compatibilidade)
 */
export async function POST(req: Request) {
  try {
    const isAdmin = await checkAdmin().catch(() => false);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado. Apenas administradores.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const resNumber = typeof body.resNumber === 'string' ? body.resNumber.trim() : '';
    const merchantOrderId = typeof body.merchantOrderId === 'string' ? body.merchantOrderId.trim() : '';
    const mode: 'logs' | 'live' | 'both' =
      body.mode === 'logs' || body.mode === 'live' ? body.mode : (body.fetchLive === false ? 'logs' : 'both');

    if (!resNumber && !merchantOrderId) {
      return NextResponse.json(
        { error: 'Informe ao menos o número da reserva (resNumber) ou merchantOrderId.' },
        { status: 400 }
      );
    }

    const fetchLogs = async () => {
      const terms = Array.from(new Set([resNumber, merchantOrderId].filter(Boolean)));
      // Números/IDs não têm variação de caixa → `contains` case-sensitive (LIKE, mais barato que ILIKE)
      const textConditions = terms.flatMap((t) => [
        { xmlRequest: { contains: t } },
        { xmlResponse: { contains: t } },
      ]);
      const since = new Date(Date.now() - LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      try {
        return await prisma.logXRS.findMany({
          where: {
            action: { in: RESERVATION_ACTIONS },
            createdAt: { gte: since },
            OR: textConditions,
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: {
            id: true,
            action: true,
            sourceFile: true,
            endpoint: true,
            xmlRequest: true,
            xmlResponse: true,
            httpStatus: true,
            durationMs: true,
            hasError: true,
            createdAt: true,
          },
        });
      } catch (logErr) {
        console.warn('[reservas/xml] Falha ao consultar LogXRS:', logErr);
        return [];
      }
    };

    const fetchLive = async () => {
      if (!resNumber || resNumber.length < 6) {
        return { liveXml: null, liveError: 'Reserva sem número GreenWay válido para consulta ao vivo.' };
      }
      try {
        return { liveXml: await getReservationRawXml(resNumber), liveError: null as string | null };
      } catch (err: any) {
        console.error('[reservas/xml] Erro live XML:', err);
        return { liveXml: null, liveError: err.message || 'Erro ao consultar GreenWay ao vivo' };
      }
    };

    const [logs, live] = await Promise.all([
      mode === 'live' ? Promise.resolve(undefined) : fetchLogs(),
      mode === 'logs' ? Promise.resolve(undefined) : fetchLive(),
    ]);

    return NextResponse.json({
      success: true,
      resNumber,
      merchantOrderId,
      ...(logs !== undefined ? { logs } : {}),
      ...(live !== undefined ? live : {}),
    });
  } catch (error: any) {
    console.error('[reservas/xml] Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno ao obter XML: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
