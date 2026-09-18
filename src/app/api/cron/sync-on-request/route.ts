import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { buildEmailCurrencyVars } from '@/lib/receiptLocales';
export const dynamic = 'force-dynamic';

/**
 * Cron: GET /api/cron/sync-on-request
 * Schedule (Coolify): */5 * * * *  (a cada 5 minutos)
 *
 * Polls XRS search.searchbyid for all reservations with status=ON_REQUEST.
 *
 * Transitions:
 *   ON_REQUEST + CF       → CONFIRMED_NON_PREPAID  (email: RESERVA_CONFIRMADA)
 *   ON_REQUEST + R + warn → ON_REQUEST_REJECTED    (cancela XRS + email: RESERVA_REJEITADA)
 *   ON_REQUEST + R        → still pending
 */

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const xrsConfig = await prisma.xRSConfig.findFirst();
    if (!xrsConfig) return NextResponse.json({ error: 'XRS config missing' }, { status: 500 });
    const pending = await prisma.localReservation.findMany({
      where: { status: 'ON_REQUEST' }, orderBy: { createdAt: 'asc' },
    });
    console.log(`[sync-on-request] Verificando ${pending.length} reservas ON_REQUEST`);
    const results: any[] = [];
    for (const reserva of pending) {
      if (!reserva.resNumber) { results.push({ id: reserva.id, status: 'skipped' }); continue; }
      try {
        const xrsResp = await callXRS(
          `<?xml version="1.0" encoding="UTF-8"?><message><serviceRequest serviceCode="search.searchbyid"><serviceParameters><reservation resNumber="${escapeXml(reserva.resNumber)}" /></serviceParameters></serviceRequest></message>`,
          { callerCode: xrsConfig.callerCode, password: xrsConfig.password, action: 'search.searchbyid', sourceFile: 'cron/sync-on-request' }
        );
        const resNode = xrsResp?.message?.serviceResponse?.reservation || xrsResp?.serviceResponse?.reservation;
        const statusCode: string = (resNode?.$.statusCode || '').toUpperCase();
        const warningList = resNode?.warningList?.warning ?? null;
        const warnings: any[] = Array.isArray(warningList) ? warningList.map((w: any) => w.$ || w) : warningList ? [warningList.$ || warningList] : [];
        const isRejected = statusCode === 'R' && warnings.some((w: any) => (w.warningDesc||'').toLowerCase().includes('onrequestitemfailed') || (w.warningDesc||'').toLowerCase().includes('nochangeallowed'));
        const isConfirmed = statusCode === 'CF';
        const parsedData = JSON.parse(reserva.customerData || '{}');
        const booking = parsedData.booking || {};
        const car = booking.car || {};
        const fmtDate = (d: string) => d && d.length >= 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : d || '';
        if (isConfirmed) {
          await prisma.localReservation.update({ where: { id: reserva.id }, data: { status: 'CONFIRMED_NON_PREPAID' } });
          const totalBRL = reserva.amountInCents ? reserva.amountInCents / 100 : 0;
          const cv = buildEmailCurrencyVars(totalBRL, booking.pickupStation, parseFloat(car.exchangeRate||'1'), car.currency||'BRL');
          const { sendTransactionalEmail } = await import('@/lib/emailService');
          await sendTransactionalEmail(parsedData.email, 'RESERVA_CONFIRMADA', {
            NOME: parsedData.nome||'', SOBRENOME: parsedData.sobrenome||'', EMAIL: parsedData.email||'',
            NUMERO_RESERVA: reserva.resNumber||'', CARRO: car.carCategoryName||car.name||'',
            DATA_RETIRADA: fmtDate(booking.pickupDate||''), LOCAL_RETIRADA: booking.pickupStation||'',
            DATA_DEVOLUCAO: fmtDate(booking.returnDate||''), LOCAL_DEVOLUCAO: booking.returnStation||booking.pickupStation||'',
            VALOR_TOTAL: cv.VALOR_TOTAL, VALOR_LOCAL: cv.VALOR_LOCAL, VALOR_BRL: cv.VALOR_BRL, MOEDA: cv.MOEDA,
            FORMA_PAGAMENTO: parsedData.paymentMethod||'Pagar no Balcão',
          });
          console.log(`[sync-on-request] CONFIRMADA: ${reserva.resNumber}`);
          results.push({ resNumber: reserva.resNumber, status: 'CONFIRMED' });
        } else if (isRejected) {
          try {
            await callXRS(
              `<?xml version="1.0" encoding="UTF-8"?><message><serviceRequest serviceCode="cancelReservation"><serviceParameters><reservation resNumber="${escapeXml(reserva.resNumber)}" /></serviceParameters></serviceRequest></message>`,
              { callerCode: xrsConfig.callerCode, password: xrsConfig.password, action: 'cancelReservation', sourceFile: 'cron/sync-on-request' }
            );
          } catch(e) { console.error('[sync-on-request] cancel XRS falhou:', e); }
          await prisma.localReservation.update({ where: { id: reserva.id }, data: { status: 'ON_REQUEST_REJECTED' } });
          const { sendTransactionalEmail } = await import('@/lib/emailService');
          await sendTransactionalEmail(parsedData.email, 'RESERVA_REJEITADA', {
            NOME: parsedData.nome||'', SOBRENOME: parsedData.sobrenome||'', EMAIL: parsedData.email||'',
            NUMERO_RESERVA: reserva.resNumber||'', CARRO: car.carCategoryName||car.name||'',
            DATA_RETIRADA: fmtDate(booking.pickupDate||''), LOCAL_RETIRADA: booking.pickupStation||'',
            DATA_DEVOLUCAO: fmtDate(booking.returnDate||''), LOCAL_DEVOLUCAO: booking.returnStation||booking.pickupStation||'',
            MOTIVO: warnings.map((w: any) => w.warningDesc||'').filter(Boolean).join(', ')||'Item não disponível',
          });
          console.log(`[sync-on-request] REJEITADA: ${reserva.resNumber}`);
          results.push({ resNumber: reserva.resNumber, status: 'REJECTED' });
        } else {
          results.push({ resNumber: reserva.resNumber, status: 'PENDING', statusCode });
        }
      } catch(err: any) {
        results.push({ resNumber: reserva.resNumber, status: 'error', reason: err.message });
      }
    }
    return NextResponse.json({ message: `Verificadas ${pending.length} reservas ON_REQUEST`, results });
  } catch(error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
