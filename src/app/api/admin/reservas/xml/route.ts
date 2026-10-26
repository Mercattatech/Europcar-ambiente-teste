import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/checkAdmin';
import prisma from '@/lib/prisma';
import { getReservationRawXml } from '@/lib/europcar/xrsClient';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reservas/xml
 *
 * Retorna o XML da reserva:
 * 1. Consulta ao vivo no GreenWay (Europcar XRS) via search.searchbyid
 * 2. Busca histórico de logs de comunicação (LogXRS) da reserva no banco local
 */
export async function POST(req: Request) {
  try {
    const isAdmin = await checkAdmin().catch(() => false);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Não autorizado. Apenas administradores.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawResNumber = body.resNumber;
    const rawMerchantOrderId = body.merchantOrderId;
    const fetchLive = body.fetchLive !== false;

    const resNumber = typeof rawResNumber === 'string' ? rawResNumber.trim() : '';
    const merchantOrderId = typeof rawMerchantOrderId === 'string' ? rawMerchantOrderId.trim() : '';

    if (!resNumber && !merchantOrderId) {
      return NextResponse.json(
        { error: 'Informe ao menos o número da reserva (resNumber) ou merchantOrderId.' },
        { status: 400 }
      );
    }

    // 1. Buscar histórico de logs no LogXRS
    const searchConditions: any[] = [];
    if (resNumber) {
      searchConditions.push(
        { xmlRequest: { contains: resNumber, mode: 'insensitive' } },
        { xmlResponse: { contains: resNumber, mode: 'insensitive' } }
      );
    }
    if (merchantOrderId && merchantOrderId !== resNumber) {
      searchConditions.push(
        { xmlRequest: { contains: merchantOrderId, mode: 'insensitive' } },
        { xmlResponse: { contains: merchantOrderId, mode: 'insensitive' } }
      );
    }

    let logs: any[] = [];
    try {
      logs = await prisma.logXRS.findMany({
        where: {
          OR: searchConditions,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
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
    }

    // 2. Consulta ao vivo no XRS (se tiver resNumber com pelo menos 6 dígitos e fetchLive for true)
    let liveXml: any = null;
    let liveError: string | null = null;

    if (fetchLive && resNumber && resNumber.length >= 6) {
      try {
        liveXml = await getReservationRawXml(resNumber);
      } catch (err: any) {
        liveError = err.message || 'Erro ao consultar GreenWay ao vivo';
        console.error('[reservas/xml] Erro live XML:', err);
      }
    }

    return NextResponse.json({
      success: true,
      resNumber,
      merchantOrderId,
      liveXml,
      liveError,
      logs,
    });
  } catch (error: any) {
    console.error('[reservas/xml] Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno ao obter XML: ' + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
