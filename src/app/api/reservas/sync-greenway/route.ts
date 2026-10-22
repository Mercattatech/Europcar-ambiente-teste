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
function mapXRSStatusToLocal(
  xrsStatus: string,
  currentLocalStatus: string,
  isPrepaid: boolean,
  isRejected?: boolean
): string | null {
  // Se XRS indicou rejeição explícita de On-Request (via warnings ou status CC/CS/CP)
  if (isRejected && currentLocalStatus === 'ON_REQUEST') {
    return 'ON_REQUEST_REJECTED';
  }

  switch (xrsStatus) {
    case 'S':
    case 'CF':
    case 'TD':
      // Confirmada no Greenway → se era ON_REQUEST, agora está confirmada (prepaid vs balcão)
      if (currentLocalStatus === 'ON_REQUEST') {
        return isPrepaid ? 'CONFIRMED_PREPAID' : 'CONFIRMED_NON_PREPAID';
      }
      return null; // já era confirmada, sem mudança
    case 'CC':
    case 'CS':
    case 'CP':
      // Cancelada no Greenway → se era ON_REQUEST, marcar como recusada; se confirmada, CANCELLED_GREENWAY
      if (currentLocalStatus === 'ON_REQUEST') {
        return 'ON_REQUEST_REJECTED';
      }
      if (!currentLocalStatus.startsWith('CANCELLED') && currentLocalStatus !== 'ON_REQUEST_REJECTED') {
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
      // Ainda On Request e sem aviso de rejeição → sem mudança
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
 *   1. Todas as ON_REQUEST / operationalStatus R (que podem ter sido confirmadas ou canceladas)
 *   2. Todas as CONFIRMED_* (que podem ter sido canceladas direto no Greenway)
 *   3. Todas as PENDING_PIX (que podem ter sido canceladas)
 *
 * Pode ser chamado:
 *   - Via cron (Coolify Scheduled Task)
 *   - Manualmente pelo admin no painel (em lote ou para uma reserva específica)
 *
 * Segurança: aceita localhost OU bearer token do cron OU query ?secret= OU sessão admin
 */
export async function POST(req: Request) {
  // Autenticação: localhost (Coolify cron) OU cron secret OU admin session
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const host = req.headers.get('host') || '';
  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');

  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const isCron = !!cronSecret && (authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret);
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
      // Sincronizar: ON_REQUEST + operationalStatus R + CONFIRMED + PENDING_PIX (dos últimos 60 dias)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      where.OR = [
        { operationalStatus: 'R' },
        { status: 'ON_REQUEST' },
        {
          status: { in: ['CONFIRMED_PREPAID', 'CONFIRMED_NON_PREPAID', 'PENDING_PIX'] },
          createdAt: { gte: sixtyDaysAgo },
        },
      ];
    }

    const reservations = await prisma.localReservation.findMany({
      where,
      select: {
        id: true,
        resNumber: true,
        status: true,
        operationalStatus: true,
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
      oldOpStatus: string;
      newOpStatus: string;
      xrsStatus: string;
      action: string;
    }[] = [];

    for (const res of reservations) {
      if (!res.resNumber) continue;

      try {
        const xrs = await readBooking(res.resNumber);

        if (!xrs.found) {
          // Reserva não encontrada no Greenway — possivelmente foi deletada ou resNumber inválido
          console.warn(`[sync-greenway] Reserva ${res.resNumber} não encontrada no XRS: ${xrs.error}`);
          continue;
        }

        // Determinar se a reserva foi paga online (Cielo/PIX)
        let isPrepaid = false;
        let customerEmail = '';
        let customerName = '';
        let customerLastName = '';
        let bookingData: any = {};
        let parsedCustomerData: any = {};
        try {
          parsedCustomerData = typeof res.customerData === 'string'
            ? JSON.parse(res.customerData)
            : (res.customerData || {});
          customerEmail = parsedCustomerData.email || parsedCustomerData.driverData?.email || parsedCustomerData.customerData?.email || '';
          customerName = parsedCustomerData.nome || parsedCustomerData.firstName || parsedCustomerData.driverData?.firstName || '';
          customerLastName = parsedCustomerData.sobrenome || parsedCustomerData.lastName || parsedCustomerData.driverData?.lastName || '';
          bookingData = parsedCustomerData.booking || parsedCustomerData.bookingData || {};
          const pm = parsedCustomerData.paymentMethod || parsedCustomerData.paymentData?.method || '';
          isPrepaid = pm === 'CREDIT' || pm === 'PIX' || !!parsedCustomerData.cieloPaymentId || res.status === 'CONFIRMED_PREPAID';
        } catch { }

        const newStatus = mapXRSStatusToLocal(xrs.xrsStatusCode, res.status, isPrepaid, xrs.isRejected);
        const oldOpStatus = res.operationalStatus || (res.status === 'ON_REQUEST' ? 'R' : 'S');
        const newOpStatus = xrs.xrsStatusCode;

        const opStatusChanged = oldOpStatus !== newOpStatus;
        const statusChanged = !!newStatus && newStatus !== res.status;

        // ── Sincronização de valores com o Greenway para reservas BALCÃO (POA) ──
        let amountChanged = false;
        let newAmountInCents: number = res.amountInCents || 0;
        let updatedCustomerDataStr: string | null = null;

        if (xrs.quote) {
          const quoteTotalBRL = parseFloat(xrs.quote.totalRateEstimateInBookingCurrency || xrs.quote.totalRateEstimate || '0');
          if (quoteTotalBRL > 0) {
            const pm = parsedCustomerData.paymentMethod || parsedCustomerData.paymentData?.method || '';
            const isBalcao = pm === 'BALCAO' || res.status === 'CONFIRMED_NON_PREPAID';

            if (isBalcao) {
              const insArr = Array.isArray(parsedCustomerData.xrsInsurances) ? parsedCustomerData.xrsInsurances : [];
              const equipArr = Array.isArray(parsedCustomerData.xrsEquipment) ? parsedCustomerData.xrsEquipment : [];
              const confirmedInsBRL = insArr.reduce((s: number, ins: any) => s + parseFloat(ins.priceBRL || 0), 0);
              const confirmedEquipBRL = equipArr.reduce((s: number, eq: any) => {
                const t = parseFloat(eq.totalBRL || 0);
                return s + (t > 0 ? t : 0);
              }, 0);
              const extrasSumBRL = confirmedInsBRL + confirmedEquipBRL;
              const expectedTotalBRL = (quoteTotalBRL >= extrasSumBRL || extrasSumBRL === 0)
                ? quoteTotalBRL
                : (quoteTotalBRL + extrasSumBRL);
              const expectedAmountInCents = Math.round(expectedTotalBRL * 100);

              if (Math.abs(expectedAmountInCents - (res.amountInCents || 0)) > 50) {
                amountChanged = true;
                newAmountInCents = expectedAmountInCents;
                if (!bookingData.car) bookingData.car = {};
                bookingData.car.totalRateEstimate = xrs.quote.totalRateEstimate;
                bookingData.car.totalRateEstimateInBookingCurrency = xrs.quote.totalRateEstimateInBookingCurrency || xrs.quote.totalRateEstimate;
                if (xrs.quote.basePrice) bookingData.car.basePrice = xrs.quote.basePrice;
                if (xrs.quote.currency) bookingData.car.currency = xrs.quote.currency;
                parsedCustomerData.booking = bookingData;
                updatedCustomerDataStr = JSON.stringify(parsedCustomerData);
                console.log(`[sync-greenway] ${res.resNumber}: Valor BALCAO sincronizado com Greenway: R$ ${(res.amountInCents || 0) / 100} → R$ ${newAmountInCents / 100}`);
              }
            }
          }
        }

        if (!opStatusChanged && !statusChanged && !amountChanged) {
          if (singleResNumber) {
            results.push({
              resNumber: res.resNumber,
              oldStatus: res.status,
              newStatus: res.status,
              oldOpStatus,
              newOpStatus,
              xrsStatus: xrs.xrsStatus,
              action: 'no_change',
            });
          }
          continue;
        }

        // ═══ STATUS, STATUS OPERACIONAL OU VALOR MUDOU ═══
        console.log(`[sync-greenway] ${res.resNumber}: status=${res.status}${statusChanged ? ` → ${newStatus}` : ''} | opStatus=${oldOpStatus} → ${newOpStatus} (XRS: ${xrs.xrsStatusCode})${amountChanged ? ` | valor=R$ ${(res.amountInCents||0)/100} → R$ ${newAmountInCents/100}` : ''}`);

        // Atualizar no banco
        await prisma.localReservation.update({
          where: { id: res.id },
          data: {
            ...(statusChanged && newStatus ? { status: newStatus } : {}),
            operationalStatus: newOpStatus,
            ...(amountChanged ? { amountInCents: newAmountInCents } : {}),
            ...(updatedCustomerDataStr ? { customerData: updatedCustomerDataStr } : {}),
          },
        });

        let action = amountChanged && !statusChanged ? 'amount_synced' : 'status_updated';

        // ── Ações específicas por tipo de mudança ──

        // 1. ON_REQUEST → CONFIRMADA (CF, S ou TD): enviar email de confirmação
        const wasOnRequest = res.status === 'ON_REQUEST';
        const isNowConfirmed = newOpStatus === 'CF' || newOpStatus === 'S' || newOpStatus === 'TD';

        if (wasOnRequest && isNowConfirmed) {
          action = 'on_request_confirmed';
          if (customerEmail) {
            try {
              const car = bookingData.car || {};
              const totalBRL = res.amountInCents ? res.amountInCents / 100 : 0;
              const { buildEmailCurrencyVars } = await import('@/lib/receiptLocales');
              const cv = buildEmailCurrencyVars(
                totalBRL,
                bookingData.pickupStation || xrs.pickupStation || '',
                parseFloat(car.exchangeRate || '1'),
                car.currency || 'BRL'
              );
              const fmtDate = (d: string) => (d && d.length >= 8 ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : d || '');
              const fmtTime = (t?: string) => {
                if (!t) return '';
                const s = t.replace(/\D/g, '');
                return s.length >= 4 ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : t;
              };

              // Listas de proteções/franquias e acessórios contratados (antes não eram enviadas
              // neste fluxo e o template exibia o texto cru {{LISTA_PROTECOES}}).
              const { buildExtrasListVars } = await import('@/lib/email/reservationEmailVars');
              const extraLists = buildExtrasListVars({ ...parsedCustomerData, booking: bookingData });

              const pickupStationCode = bookingData.pickupStation || xrs.pickupStation || '';
              const pickupStationName = bookingData.pickupStationName || pickupStationCode;
              const pickupStationAddress = bookingData.pickupStationAddress || bookingData.pickupAddress || bookingData.stationAddress || '';
              const pickupStationPhone = bookingData.pickupStationPhone || '';

              const returnStationCode = bookingData.returnStation || bookingData.pickupStation || xrs.pickupStation || '';
              const returnStationName = bookingData.returnStationName || (returnStationCode === pickupStationCode ? pickupStationName : returnStationCode);
              const returnStationAddress = bookingData.returnStationAddress || bookingData.returnAddress || (returnStationCode === pickupStationCode ? pickupStationAddress : '');
              const returnStationPhone = bookingData.returnStationPhone || (returnStationCode === pickupStationCode ? pickupStationPhone : '');

              const formatLine = (name: string, code: string, addr: string) => {
                if (!code) return '';
                const head = name && name !== code ? `${name} (${code})` : code;
                return addr ? `${head} — ${addr}` : head;
              };

              const emailVars: Record<string, string> = {
                NOME: customerName,
                SOBRENOME: customerLastName,
                EMAIL: customerEmail,
                TELEFONE: parsedCustomerData.telefone || '',
                CPF: parsedCustomerData.cpf || '',
                NUMERO_RESERVA: res.resNumber || '',
                CARRO: car.carCategoryName || car.name || xrs.carCategory || '',
                DATA_RETIRADA: fmtDate(bookingData.pickupDate || xrs.pickupDate || ''),
                HORARIO_RETIRADA: fmtTime(bookingData.pickupTime || xrs.pickupTime || ''),
                CODIGO_LOJA_RETIRADA: pickupStationCode,
                NOME_LOJA_RETIRADA: pickupStationName,
                ENDERECO_LOJA_RETIRADA: pickupStationAddress,
                TELEFONE_LOJA_RETIRADA: pickupStationPhone,
                LOCAL_RETIRADA: formatLine(pickupStationName, pickupStationCode, pickupStationAddress),
                DATA_DEVOLUCAO: fmtDate(bookingData.returnDate || xrs.returnDate || ''),
                HORARIO_DEVOLUCAO: fmtTime(bookingData.returnTime || xrs.returnTime || ''),
                CODIGO_LOJA_DEVOLUCAO: returnStationCode,
                NOME_LOJA_DEVOLUCAO: returnStationName,
                ENDERECO_LOJA_DEVOLUCAO: returnStationAddress,
                TELEFONE_LOJA_DEVOLUCAO: returnStationPhone,
                LOCAL_DEVOLUCAO: formatLine(returnStationName, returnStationCode, returnStationAddress),
                LISTA_PROTECOES: extraLists.LISTA_PROTECOES,
                LISTA_EXTRAS: extraLists.LISTA_EXTRAS,
                VALOR_TOTAL: cv.VALOR_TOTAL,
                VALOR_LOCAL: cv.VALOR_LOCAL,
                VALOR_BRL: cv.VALOR_BRL,
                MOEDA: cv.MOEDA,
                MOEDA_ESTRANGEIRA: cv.MOEDA !== 'BRL' ? '1' : '',
                FORMA_PAGAMENTO: isPrepaid ? 'Pago Online (Cielo)' : 'Pagar no Balcão',
                STATUS: 'Confirmada',
                MENSAGEM: 'Sua reserva On Request foi CONFIRMADA pela Europcar! Sua locação está garantida.',
              };

              let sent = await sendTransactionalEmail(customerEmail, 'RESERVA_CONFIRMADA', emailVars);
              if (!sent.success) {
                sent = await sendTransactionalEmail(customerEmail, 'RESERVA_SUCESSO', emailVars);
              }
              if (!sent.success) {
                console.log(`[sync-greenway] Template não encontrado no banco ou falhou. Enviando via sendBookingConfirmation fallback...`);
                const { sendBookingConfirmation } = await import('@/lib/email/sendBookingConfirmation');
                await sendBookingConfirmation({
                  toEmail: customerEmail,
                  customerName: `${customerName} ${customerLastName}`.trim(),
                  resNumber: res.resNumber || '',
                  carName: car.carCategoryName || car.name || xrs.carCategory || '',
                  pickupStation: pickupStationCode,
                  returnStation: returnStationCode,
                  pickupStationName,
                  returnStationName,
                  pickupStationAddress,
                  returnStationAddress,
                  pickupStationPhone,
                  returnStationPhone,
                  pickupDate: bookingData.pickupDate || xrs.pickupDate || '',
                  returnDate: bookingData.returnDate || xrs.returnDate || '',
                  paymentMethod: isPrepaid ? 'CREDIT' : 'BALCAO',
                  totalBRL: totalBRL,
                  isOnRequest: false,
                  xrsEquipment: extraLists.equipment,
                  extras: extraLists.extras,
                });
              }
            } catch (emailErr: any) {
              console.error(`[sync-greenway] Erro ao enviar email de confirmação para ${res.resNumber}:`, emailErr.message);
            }
          }
        }

        // 2. ON_REQUEST → REJEITADA / CANCELADA (estorno se pré-pago + email de recusa)
        else if (newStatus === 'ON_REQUEST_REJECTED') {
          action = 'on_request_rejected';

          // Estornar pagamento Cielo (se houver cobrança online prévia)
          try {
            const voidResult = await voidCieloPaymentForLocalReservation(res.id);
            if (voidResult.attempted) {
              console.log(`[sync-greenway] Estorno Cielo para On-Request rejeitada ${res.resNumber}: ${voidResult.success ? 'OK' : 'FALHOU'}`);
            }
          } catch (voidErr: any) {
            console.error(`[sync-greenway] Erro ao estornar ${res.resNumber}:`, voidErr.message);
          }

          if (customerEmail) {
            try {
              const cancelPickupCode = bookingData?.pickupStation || xrs.pickupStation || '';
              const cancelPickupName = bookingData?.pickupStationName || cancelPickupCode;
              const cancelPickupAddress = bookingData?.pickupStationAddress || bookingData?.pickupAddress || bookingData?.stationAddress || '';
              const cancelReturnCode = bookingData?.returnStation || bookingData?.pickupStation || xrs.pickupStation || '';
              const cancelReturnName = bookingData?.returnStationName || (cancelReturnCode === cancelPickupCode ? cancelPickupName : cancelReturnCode);
              const cancelReturnAddress = bookingData?.returnStationAddress || bookingData?.returnAddress || (cancelReturnCode === cancelPickupCode ? cancelPickupAddress : '');

              let sent = await sendTransactionalEmail(customerEmail, 'RESERVA_REJEITADA', {
                NOME: customerName,
                NUMERO_RESERVA: res.resNumber || '',
                STATUS: 'Recusada',
                MENSAGEM: 'Sua solicitação de reserva On Request não pôde ser confirmada pela Europcar para a categoria solicitada. Nenhuma cobrança foi realizada.',
                CODIGO_LOJA_RETIRADA: cancelPickupCode,
                NOME_LOJA_RETIRADA: cancelPickupName,
                ENDERECO_LOJA_RETIRADA: cancelPickupAddress,
                CODIGO_LOJA_DEVOLUCAO: cancelReturnCode,
                NOME_LOJA_DEVOLUCAO: cancelReturnName,
                ENDERECO_LOJA_DEVOLUCAO: cancelReturnAddress,
              });
              if (!sent.success) {
                sent = await sendTransactionalEmail(customerEmail, 'CANCELAMENTO', {
                  NOME: customerName,
                  NUMERO_RESERVA: res.resNumber || '',
                  STATUS: 'Recusada',
                  MENSAGEM: 'Sua solicitação de reserva On Request não pôde ser confirmada pela Europcar.',
                  CODIGO_LOJA_RETIRADA: cancelPickupCode,
                  NOME_LOJA_RETIRADA: cancelPickupName,
                  ENDERECO_LOJA_RETIRADA: cancelPickupAddress,
                  CODIGO_LOJA_DEVOLUCAO: cancelReturnCode,
                  NOME_LOJA_DEVOLUCAO: cancelReturnName,
                  ENDERECO_LOJA_DEVOLUCAO: cancelReturnAddress,
                });
              }
              if (!sent.success) {
                const { sendCancellationEmail } = await import('@/lib/email/sendCancellationEmail');
                await sendCancellationEmail({
                  toEmail: customerEmail,
                  customerName: `${customerName} ${customerLastName}`.trim(),
                  resNumber: res.resNumber || '',
                  carName: bookingData?.car?.carCategoryName || bookingData?.car?.name || xrs.carCategory || '',
                  pickupStation: cancelPickupCode,
                  pickupStationName: cancelPickupName,
                  pickupStationAddress: cancelPickupAddress,
                  returnStation: cancelReturnCode,
                  returnStationName: cancelReturnName,
                  returnStationAddress: cancelReturnAddress,
                  pickupDate: bookingData?.pickupDate || xrs.pickupDate || '',
                  returnDate: bookingData?.returnDate || xrs.returnDate || '',
                  paymentMethod: isPrepaid ? 'CREDIT' : 'BALCAO',
                  totalBRL: res.amountInCents ? res.amountInCents / 100 : 0,
                });
              }
            } catch (emailErr: any) {
              console.error(`[sync-greenway] Erro ao enviar email de rejeição para ${res.resNumber}:`, emailErr.message);
            }
          }
        }

        // 3. CANCELAMENTO direto no Greenway para reservas confirmadas: estornar Cielo + email de cancelamento
        else if (newStatus === 'CANCELLED_GREENWAY') {
          action = 'cancelled_by_greenway';

          // Estornar pagamento Cielo (se houver cobrança online)
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
              const cancelPickupCode = bookingData?.pickupStation || xrs.pickupStation || '';
              const cancelPickupName = bookingData?.pickupStationName || cancelPickupCode;
              const cancelPickupAddress = bookingData?.pickupStationAddress || bookingData?.pickupAddress || bookingData?.stationAddress || '';
              const cancelReturnCode = bookingData?.returnStation || bookingData?.pickupStation || xrs.pickupStation || '';
              const cancelReturnName = bookingData?.returnStationName || (cancelReturnCode === cancelPickupCode ? cancelPickupName : cancelReturnCode);
              const cancelReturnAddress = bookingData?.returnStationAddress || bookingData?.returnAddress || (cancelReturnCode === cancelPickupCode ? cancelPickupAddress : '');

              let sent = await sendTransactionalEmail(customerEmail, 'CANCELAMENTO', {
                NOME: customerName,
                NUMERO_RESERVA: res.resNumber || '',
                STATUS: 'Cancelada',
                MENSAGEM: 'Sua reserva foi cancelada pela operação Europcar. Caso tenha sido cobrado online, o estorno será processado automaticamente.',
                CODIGO_LOJA_RETIRADA: cancelPickupCode,
                NOME_LOJA_RETIRADA: cancelPickupName,
                ENDERECO_LOJA_RETIRADA: cancelPickupAddress,
                CODIGO_LOJA_DEVOLUCAO: cancelReturnCode,
                NOME_LOJA_DEVOLUCAO: cancelReturnName,
                ENDERECO_LOJA_DEVOLUCAO: cancelReturnAddress,
              });
              if (!sent.success) {
                const { sendCancellationEmail } = await import('@/lib/email/sendCancellationEmail');
                await sendCancellationEmail({
                  toEmail: customerEmail,
                  customerName: `${customerName} ${customerLastName}`.trim(),
                  resNumber: res.resNumber || '',
                  carName: bookingData?.car?.carCategoryName || bookingData?.car?.name || xrs.carCategory || '',
                  pickupStation: cancelPickupCode,
                  pickupStationName: cancelPickupName,
                  pickupStationAddress: cancelPickupAddress,
                  returnStation: cancelReturnCode,
                  returnStationName: cancelReturnName,
                  returnStationAddress: cancelReturnAddress,
                  pickupDate: bookingData?.pickupDate || xrs.pickupDate || '',
                  returnDate: bookingData?.returnDate || xrs.returnDate || '',
                  paymentMethod: isPrepaid ? 'CREDIT' : 'BALCAO',
                  totalBRL: res.amountInCents ? res.amountInCents / 100 : 0,
                });
              }
            } catch (emailErr: any) {
              console.error(`[sync-greenway] Erro ao enviar email de cancelamento para ${res.resNumber}:`, emailErr.message);
            }
          }
        }

        results.push({
          resNumber: res.resNumber,
          oldStatus: res.status,
          newStatus: newStatus || res.status,
          oldOpStatus,
          newOpStatus,
          xrsStatus: xrs.xrsStatus,
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
