import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';
import { executeXRSBooking } from '@/lib/europcar/bookXRS';

export const dynamic = 'force-dynamic';

const MAX_PIX_REMINDERS = 5;
const PIX_REMINDER_DELAY_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
   try {
      // Find all pending PIX reservations created in the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const pendingReservations = await prisma.localReservation.findMany({
         where: { 
            status: 'PENDING_PIX',
            createdAt: { gte: yesterday }
         }
      });

      if (pendingReservations.length === 0) {
         return NextResponse.json({ message: "Nenhuma reserva PIX pendente nas últimas 24h." });
      }

      const cieloConfig = await prisma.cieloConfig.findFirst();
      if (!cieloConfig) return NextResponse.json({ error: 'Configuração Cielo não encontrada' }, { status: 500 });

      // Get site URL for retry links
      const siteUrlBlock = await prisma.contentBlock.findUnique({ where: { key: 'SITE_URL' } });
      const siteUrl = siteUrlBlock?.value_ptBR || 'https://europcar.com.br';

      const results = [];

      for (const reserva of pendingReservations) {
         try {
            const parsedData: any = JSON.parse(reserva.customerData as string);
            const paymentId = parsedData?.paymentId;

            if (!paymentId) {
               results.push({ id: reserva.id, status: 'error', reason: 'Sem paymentId' });
               continue;
            }

            const CIELO_QUERY_URL = cieloConfig.isSandbox 
               ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`
               : `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;
            
            const resCielo = await fetch(CIELO_QUERY_URL, {
               headers: {
                  "MerchantId": String(cieloConfig.merchantId || '').trim(),
                  "MerchantKey": String(cieloConfig.merchantKey || '').trim(),
               }
            });

            if (!resCielo.ok) {
               results.push({ id: reserva.id, status: 'error', reason: 'Cielo API request failed' });
               continue;
            }

            const cieloJson = await resCielo.json();
            
            // ═══ PIX PAID ═══
            if (cieloJson.Payment && (cieloJson.Payment.Status === 2 || cieloJson.Payment.Status === 1)) {
               let resNumber = reserva.merchantOrderId;
               try {
                  const { resNumber: europcarResNumber } = await executeXRSBooking({
                      bookingData: parsedData.booking,
                      customerData: parsedData,
                      paymentData: { method: 'PIX', amountInCents: reserva.amountInCents, merchantOrderId: reserva.merchantOrderId },
                      xrsEquipment: parsedData.booking?.xrsEquipment || [],
                  });
                  if (europcarResNumber) resNumber = europcarResNumber;
               } catch (e: any) {
                  console.error("SYNC-PIX: Error executing XRS Booking", e.message);
               }
               
               await prisma.localReservation.update({
                  where: { id: reserva.id },
                  data: {
                     resNumber,
                     status: 'CONFIRMED_PREPAID'
                  }
               });

               // Disparar Email
               if (parsedData?.email) {
                  try {
                     const fmtDate = (d: string) => d && d.length >= 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : d || '';
                     const booking = parsedData.booking || {};
                     const totalBRL = (cieloJson.Payment.Amount / 100).toFixed(2).replace('.', ',');
                     await sendTransactionalEmail(parsedData.email, 'RESERVA_SUCESSO', {
                        NOME: parsedData.nome || '',
                        SOBRENOME: parsedData.sobrenome || '',
                        EMAIL: parsedData.email || '',
                        TELEFONE: parsedData.telefone || '',
                        CPF: parsedData.cpf || '',
                        NUMERO_RESERVA: resNumber,
                        VALOR_TOTAL: `R$ ${totalBRL}`,
                        FORMA_PAGAMENTO: 'PIX',
                        CARRO: booking.car?.carCategoryName || booking.car?.name || '',
                        CATEGORIA_CARRO: booking.car?.acrissCode || booking.carCategory || '',
                        DATA_RETIRADA: fmtDate(booking.pickupDate || ''),
                        LOCAL_RETIRADA: booking.pickupStation || '',
                        DATA_DEVOLUCAO: fmtDate(booking.returnDate || ''),
                        LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
                        LISTA_PROTECOES: '',
                        LISTA_EXTRAS: '',
                     });
                  } catch (e) {
                     console.error("Erro ao enviar email PIX Sincronizado:", e);
                  }
               }

               // ── WhatsApp: PIX_AGRADECIMENTO ──
               try {
                  const booking = parsedData.booking || {};
                  const totalBRL = `R$ ${(cieloJson.Payment.Amount / 100).toFixed(2).replace('.', ',')}`;
                  import('@/lib/whatsapp/whatsappService').then(({ sendWhatsappTrigger }) => {
                     sendWhatsappTrigger('PIX_AGRADECIMENTO', {
                        NOME: parsedData.nome || '',
                        SOBRENOME: parsedData.sobrenome || '',
                        NUMERO_RESERVA: resNumber,
                        VALOR_TOTAL: totalBRL,
                        CARRO: booking.car?.carCategoryName || booking.car?.name || '',
                        DATA_RETIRADA: booking.pickupDate || '',
                        DATA_DEVOLUCAO: booking.returnDate || '',
                        LOCAL_RETIRADA: booking.pickupStation || '',
                        LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
                     }, parsedData.telefone || undefined);
                  });
               } catch (waErr) {
                  console.error('[sync-pix] WhatsApp agradecimento falhou:', waErr);
               }

               results.push({ id: reserva.id, orderId: reserva.merchantOrderId, status: 'PAID' });

            // ═══ PIX STILL PENDING ═══
            } else {
               // Check if we should send a reminder
               const pixReminderCount = parsedData.pixReminderCount || 0;
               const lastReminderAt = parsedData.pixReminderLastAt ? new Date(parsedData.pixReminderLastAt).getTime() : 0;
               const createdAtMs = new Date(reserva.createdAt).getTime();
               const now = Date.now();
               const timeSinceCreation = now - createdAtMs;
               const timeSinceLastReminder = now - lastReminderAt;

               // Send reminder if:
               // 1. Less than MAX_PIX_REMINDERS sent
               // 2. At least 5 min since creation (first reminder) or since last reminder
               // 3. Has phone number
               if (
                  pixReminderCount < MAX_PIX_REMINDERS &&
                  timeSinceCreation >= PIX_REMINDER_DELAY_MS &&
                  (pixReminderCount === 0 || timeSinceLastReminder >= PIX_REMINDER_DELAY_MS) &&
                  parsedData.telefone
               ) {
                  const retryLink = `${siteUrl}/pix-retry/${reserva.merchantOrderId}`;
                  const totalBRL = `R$ ${(reserva.amountInCents / 100).toFixed(2).replace('.', ',')}`;
                  const booking = parsedData.booking || {};

                  try {
                     const { sendWhatsappTrigger } = await import('@/lib/whatsapp/whatsappService');
                     await sendWhatsappTrigger('PIX_LEMBRETE', {
                        NOME: parsedData.nome || '',
                        SOBRENOME: parsedData.sobrenome || '',
                        NUMERO_RESERVA: reserva.merchantOrderId || '',
                        VALOR_TOTAL: totalBRL,
                        LINK_RETRY_PIX: retryLink,
                        CARRO: booking.car?.carCategoryName || booking.car?.name || '',
                        DATA_RETIRADA: booking.pickupDate || '',
                        DATA_DEVOLUCAO: booking.returnDate || '',
                        LOCAL_RETIRADA: booking.pickupStation || '',
                        LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
                     }, parsedData.telefone);

                     console.log(`[sync-pix] 📲 Lembrete PIX #${pixReminderCount + 1} enviado para ${parsedData.telefone} (${reserva.merchantOrderId})`);
                  } catch (waErr) {
                     console.error('[sync-pix] WhatsApp lembrete falhou:', waErr);
                  }

                  // Update reminder counter
                  const updatedData = {
                     ...parsedData,
                     pixReminderCount: pixReminderCount + 1,
                     pixReminderLastAt: new Date().toISOString(),
                  };
                  await prisma.localReservation.update({
                     where: { id: reserva.id },
                     data: { customerData: JSON.stringify(updatedData) },
                  });

                  results.push({
                     id: reserva.id,
                     orderId: reserva.merchantOrderId,
                     status: 'PENDING',
                     reminderSent: pixReminderCount + 1,
                  });
               } else {
                  results.push({ id: reserva.id, orderId: reserva.merchantOrderId, status: 'PENDING' });
               }
            }
         } catch (error) {
            results.push({ id: reserva.id, status: 'error', reason: String(error) });
         }
      }

      return NextResponse.json({ 
         message: `Verificadas ${pendingReservations.length} reservas`, 
         results 
      });

   } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
   }
}
