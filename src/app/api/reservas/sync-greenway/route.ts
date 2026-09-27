import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { readBooking } from '@/lib/europcar/xrsClient';
import { sendTransactionalEmail } from '@/lib/emailService';
import { voidCieloPaymentForLocalReservation } from '@/lib/europcar/cancelService';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

/**
 * Mapeamento de statusCode XRS → status local do nosso sistema.
 *
 * XRS Status Codes:
 *   S  = Confirmed/Saved
 *   R  = Request (On Request)
 *   CF = Confirmed by Backoffice
 *   CC = Cancelled by Customer
 *   CS = Cancelled by Station/System
 *   CP = Cancelled due to Payment
 *   CO = Closed Out (Check-out realizado)
 *   NS = No Show
 *   TD = To Deliver
 */
function mapXRSStatusToLocal(xrsStatus: string, currentLocalStatus: string): string | null {
  switch (xrsStatus) {
    case 'S':
    case 'CF':
    case 'TD':
      // Confirmada no Greenway → se era ON_REQUEST, agora está confirmada
      if (currentLocalStatus === 'ON_REQUEST') {
        return 'CONFIRMED_NON_PREPAID';
      }
      return null; // já era confirmada, sem mudança
    case 'CC':
    case 'CS':
    case 'CP':
      // Cancelada no Greenway → marcar como cancelada localmente
      if (!currentLocalStatus.startsWith('CANCELLED')) {
        return 'CANCELLED_GREENWAY';
      }
      return null;
    case 'NS':
      // No Show
      if (currentLocalStatus !== 'NO_SHOW') {
        return 'NO_SHOW';
      }
      return null;
    case 'CO':
      // Check-out realizado
      if (currentLocalStatus !== 'CHECKED_OUT') {
        return 'CHECKED_OUT';
      }
      return null;
    case 'R':
      // Ainda On Request → sem mudança
      return null;
    default:
      return null;
  }
}

/**
 * POST /api/reservas/sync-greenway
 *
 * Sincroniza status de todas as reservas locais com o Greenway (XRS).
 * Processa:
 *   1. Todas as ON_REQUEST (que podem ter sido confirmadas ou canceladas)
 *   2. Todas as CONFIRMED_* (que podem ter sido canceladas direto no Greenway)
 *   3. Todas as PENDING_PIX (que podem ter sido canceladas)
 *
 * Pode ser chamado:
 *   - Via cron (ex: a cada 15 minutos pela Vercel)
 *   - Manualmente pelo admin no painel
 *
 * Segurança: aceita bearer token do cron OU sessão admin
 */
export async function POST(req: Request) {
  // Autenticação: localhost (Coolify cron) OU cron secret OU admin session
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const host = req.headers.get('host') || '';

  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isAdmin = await checkAdmin().catch(() => false);

  if (!isLocalhost && !isCron && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const singleResNumber = body.resNumber; // Para sincronizar uma reserva específica

  try {
    // Buscar reservas que precisam ser sincronizadas
    const where: any = {
      resNumber: { not: null },
    };

    if (singleResNumber) {
      where.resNumber = singleResNumber;
    } else {
      // Sincronizar: ON_REQUEST + CONFIRMED + PENDING_PIX (dos últimos 60 dias)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      where.status = {
        in: ['ON_REQUEST', 'CONFIRMED_PREPAID', 'CONFIRMED_NON_PREPAID', 'PENDING_PIX'],
      };
      where.createdAt = { gte: sixtyDaysAgo };
    }

    const reservations = await prisma.localReservation.findMany({
      where,
      select: {
        id: true,
        resNumber: true,
        status: true,
        customerData: true,
        amountInCents: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // Limitar por batch
    });

    const results: {
      resNumber: string;
      oldStatus: string;
      newStatus: string;
      xrsStatus: string;
      action: string;
    }[] = [];

    for (const res of reservations) {
      if (!res.resNumber) continue;

      try {
        const xrs = await readBooking(res.resNumber);

        if (!xrs.found) {
          // Reserva não encontrada no Greenway — possivelmente foi deletada
          console.warn(`[sync-greenway] Reserva ${res.resNumber} não encontrada no XRS: ${xrs.error}`);
          continue;
        }

        const newStatus = mapXRSStatusToLocal(xrs.xrsStatusCode, res.status);

        if (!newStatus) {
          // Sem mudança de status
          // Atualizar operationalStatus mesmo assim
          await prisma.localReservation.update({
            where: { id: res.id },
            data: { operationalStatus: xrs.xrsStatusCode },
          });
          continue;
        }

        // ═══ STATUS MUDOU ═══
        console.log(`[sync-greenway] ${res.resNumber}: ${res.status} → ${newStatus} (XRS: ${xrs.xrsStatusCode})`);

        // Atualizar no banco
        await prisma.localReservation.update({
          where: { id: res.id },
          data: {
            status: newStatus,
            operationalStatus: xrs.xrsStatusCode,
          },
        });

        let action = 'status_updated';

        // Extrair email do cliente
        let customerEmail = '';
        let customerName = '';
        try {
          const parsed = typeof res.customerData === 'string'
            ? JSON.parse(res.customerData)
            : (res.customerData || {});
          customerEmail = parsed.email || '';
          customerName = parsed.nome || '';
        } catch { }

        // ── Ações específicas por tipo de mudança ──

        // ON_REQUEST → CONFIRMADA: enviar email de confirmação
        if (res.status === 'ON_REQUEST' && newStatus === 'CONFIRMED_NON_PREPAID') {
          action = 'on_request_confirmed';
          if (customerEmail) {
            try {
              await sendTransactionalEmail(customerEmail, 'confirmacao', {
                nome: customerName,
                resNumber: res.resNumber,
                status: 'Confirmada',
                mensagem: 'Sua reserva On Request foi CONFIRMADA pela Europcar! Sua locação está garantida.',
              });
            } catch (emailErr: any) {
              console.error(`[sync-greenway] Erro ao enviar email de confirmação para ${res.resNumber}:`, emailErr.message);
            }
          }
        }

        // CANCELAMENTO detectado: estornar pagamento + enviar email
        if (newStatus === 'CANCELLED_GREENWAY') {
          action = 'cancelled_by_greenway';

          // Estornar pagamento Cielo (se houver)
          try {
            const voidResult = await voidCieloPaymentForLocalReservation(res.id);
            if (voidResult.attempted) {
              console.log(`[sync-greenway] Estorno Cielo para ${res.resNumber}: ${voidResult.success ? 'OK' : 'FALHOU'}`);
            }
          } catch (voidErr: any) {
            console.error(`[sync-greenway] Erro ao estornar ${res.resNumber}:`, voidErr.message);
          }

          // Enviar email de cancelamento
          if (customerEmail) {
            try {
              await sendTransactionalEmail(customerEmail, 'cancelamento', {
                nome: customerName,
                resNumber: res.resNumber,
                status: 'Cancelada',
                mensagem: 'Sua reserva foi cancelada pela operação Europcar. Caso tenha sido cobrado, o estorno será processado automaticamente.',
              });
            } catch (emailErr: any) {
              console.error(`[sync-greenway] Erro ao enviar email de cancelamento para ${res.resNumber}:`, emailErr.message);
            }
          }
        }

        // ON_REQUEST → CANCELADA: informar que foi recusada
        if (res.status === 'ON_REQUEST' && (newStatus === 'CANCELLED_GREENWAY' || newStatus === 'NO_SHOW')) {
          action = 'on_request_rejected';
          if (customerEmail) {
            try {
              await sendTransactionalEmail(customerEmail, 'cancelamento', {
                nome: customerName,
                resNumber: res.resNumber,
                status: 'Recusada',
                mensagem: 'Sua solicitação de reserva On Request não foi confirmada pela Europcar. Nenhuma cobrança foi realizada.',
              });
            } catch (emailErr: any) {
              console.error(`[sync-greenway] Erro ao enviar email de rejeição para ${res.resNumber}:`, emailErr.message);
            }
          }
        }

        results.push({
          resNumber: res.resNumber,
          oldStatus: res.status,
          newStatus,
          xrsStatus: xrs.xrsStatusCode,
          action,
        });

      } catch (resErr: any) {
        console.error(`[sync-greenway] Erro ao processar ${res.resNumber}:`, resErr.message);
      }

      // Delay entre chamadas para não sobrecarregar o XRS
      await new Promise(r => setTimeout(r, 300));
    }

    return NextResponse.json({
      ok: true,
      synced: reservations.length,
      changes: results.length,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('[sync-greenway] Erro geral:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — status check rápido
export async function GET() {
  const pendingOnRequest = await prisma.localReservation.count({
    where: { status: 'ON_REQUEST' },
  });

  const lastSync = await prisma.logXRS.findFirst({
    where: { action: 'readBooking' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  return NextResponse.json({
    pendingOnRequest,
    lastSyncAt: lastSync?.createdAt || null,
    status: 'ok',
  });
}
