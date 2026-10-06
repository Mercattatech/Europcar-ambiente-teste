import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { executeXRSBooking } from '@/lib/europcar/bookXRS';
import { acquirePixLock, releasePixLock } from '@/lib/pixLock';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId') || searchParams.get('merchantOrderId');

  if (!orderId) {
     return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  try {
     const reservaLocal = await prisma.localReservation.findUnique({
         where: { merchantOrderId: orderId }
     });

     if (!reservaLocal) {
         console.warn(`[pix-status] Reserva não encontrada para orderId: ${orderId}`);
         return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
     }

     console.log(`[pix-status] orderId=${orderId} | status=${reservaLocal.status} | resNumber=${reservaLocal.resNumber}`);

     if (['CONFIRMED_PREPAID', 'ON_REQUEST'].includes(reservaLocal.status) && reservaLocal.resNumber) {
         return NextResponse.json({ status: 'PAID', resNumber: reservaLocal.resNumber });
     }

     // Check PIX status for PENDING_PIX, ON_REQUEST, and any non-final status
     const isPendingPix = ['PENDING_PIX', 'ON_REQUEST'].includes(reservaLocal.status);
     if (!isPendingPix) {
        console.log(`[pix-status] Status ${reservaLocal.status} não é elegível para verificação PIX`);
        return NextResponse.json({ status: 'PENDING', dbStatus: reservaLocal.status });
     }

     // Consulta API da Cielo para ver se pagou
     const cieloConfig = await prisma.cieloConfig.findFirst();
     if (!cieloConfig) {
        console.error('[pix-status] Sem configuração Cielo no banco');
        return NextResponse.json({ error: 'chaves da cielo falha' }, { status: 500 });
     }
     
     let parsedData: any;
     try {
        parsedData = JSON.parse(reservaLocal.customerData as string);
     } catch (parseErr) {
        console.error(`[pix-status] Falha ao parsear customerData para ${orderId}`);
        return NextResponse.json({ status: 'PENDING', error: 'customerData inválido' });
     }

     const paymentId = parsedData.paymentId || parsedData.cieloPaymentId;

     if (!paymentId) {
        console.error(`[pix-status] SEM paymentId no customerData para ${orderId}. Keys: ${Object.keys(parsedData).join(', ')}`);
        return NextResponse.json({ status: 'PENDING', error: 'paymentId ausente' });
     }

     // CRITICAL: mesma coerção estrita usada na criação do PIX (reservas/route.ts)
     const isSandbox = cieloConfig.isSandbox === true;
     console.log(`[pix-status] Consultando Cielo paymentId=${paymentId} | sandbox=${isSandbox} (raw: ${cieloConfig.isSandbox}, type: ${typeof cieloConfig.isSandbox})`);

     const CIELO_QUERY_URL = isSandbox 
        ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`
        : `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;

     console.log(`[pix-status] URL: ${CIELO_QUERY_URL}`);

     const resCielo = await fetch(CIELO_QUERY_URL, {
         headers: {
            "MerchantId": cieloConfig.merchantId,
            "MerchantKey": cieloConfig.merchantKey
         },
         cache: 'no-store',  // CRITICAL: sem isso Next.js cacheia a primeira resposta (Status 12) para sempre
     });

     if (!resCielo.ok) {
        const errText = await resCielo.text().catch(() => '');
        console.error(`[pix-status] Cielo retornou HTTP ${resCielo.status} para ${paymentId}: ${errText.slice(0, 200)}`);
        return NextResponse.json({ status: 'PENDING', cieloHttpError: resCielo.status });
     }

     let cieloJson: any;
     try {
        cieloJson = await resCielo.json();
     } catch {
        console.error(`[pix-status] Cielo retornou resposta não-JSON para ${paymentId}`);
        return NextResponse.json({ status: 'PENDING', error: 'resposta Cielo inválida' });
     }

     // Usa Number() para garantir comparação correta (Cielo pode retornar string ou int)
     const cieloPaymentStatus = Number(cieloJson?.Payment?.Status ?? -1);
     console.log(`[pix-status] Cielo Payment.Status=${cieloPaymentStatus} (raw: ${cieloJson?.Payment?.Status}, type: ${typeof cieloJson?.Payment?.Status}) para ${paymentId}`);

     // Status 1 = Authorized, Status 2 = PaymentConfirmed — ambos = pago para PIX
     const isPaid = cieloPaymentStatus === 1 || cieloPaymentStatus === 2;

     if (!isPaid) {
        // Status 12 = Pending, 0 = Not Finished, 3 = Denied
        const statusNames: Record<number, string> = { 0: 'NotFinished', 1: 'Authorized', 2: 'Paid', 3: 'Denied', 10: 'Voided', 11: 'Refunded', 12: 'Pending', 13: 'Aborted' };
        console.log(`[pix-status] PIX ainda não pago. Status: ${cieloPaymentStatus} (${statusNames[cieloPaymentStatus] || 'Unknown'}) | sandbox=${isSandbox}`);
        return NextResponse.json({ status: 'PENDING', cieloStatus: cieloPaymentStatus, cieloStatusName: statusNames[cieloPaymentStatus] || 'Unknown', sandbox: isSandbox });
     }

      // ══════════════════════════════════════════════════════════════
      // PIX PAGO! Processar reserva XRS + atualizar banco
      // ══════════════════════════════════════════════════════════════
      // Lock em memória: o polling do checkout (a cada 5s), o painel admin e o cron sync-pix
      // podem chegar aqui ao mesmo tempo enquanto o XRS ainda responde. Sem o lock a reserva
      // era criada em duplicidade e os e-mails disparados mais de uma vez.
      const lockKey = `pix:${reservaLocal.id}`;
      if (!acquirePixLock(lockKey)) {
         console.log(`[pix-status] ${orderId} já está sendo processado por outra requisição.`);
         return NextResponse.json({ status: 'PENDING', processing: true });
      }

      try {
      // Reconsulta após obter o lock: outra requisição pode ter concluído no intervalo.
      const fresh = await prisma.localReservation.findUnique({ where: { id: reservaLocal.id } });
      if (fresh?.resNumber && ['CONFIRMED_PREPAID', 'ON_REQUEST'].includes(fresh.status)) {
         return NextResponse.json({ status: 'PAID', resNumber: fresh.resNumber });
      }

      console.log(`[pix-status] ✅ PIX PAGO! Processando reserva XRS para ${orderId}...`);

      let resNumber = reservaLocal.merchantOrderId;
      let isBookingOnRequest = false;
      let xrsStatus = 'S';
      try {
          const xrsRes = await executeXRSBooking({
              bookingData: parsedData.booking,
              customerData: parsedData,
              paymentData: { method: 'PIX', amountInCents: reservaLocal.amountInCents, merchantOrderId: reservaLocal.merchantOrderId },
              // Mesmas origens usadas na criação do e-mail: o checkout grava as listas no topo
              // do customerData e também dentro de booking.
              xrsEquipment: parsedData.xrsEquipment || parsedData.booking?.xrsEquipment || [],
              xrsInsurances: parsedData.xrsInsurances || parsedData.booking?.xrsInsurances || [],
          });
          if (xrsRes.resNumber) {
             resNumber = xrsRes.resNumber;
             isBookingOnRequest = !!xrsRes.isOnRequest;
             xrsStatus = xrsRes.xrsStatusCode || (isBookingOnRequest ? 'R' : 'S');
             console.log(`[pix-status] ✅ Reserva XRS criada: ${resNumber} (OnRequest: ${isBookingOnRequest}, opStatus: ${xrsStatus})`);
          }
      } catch (e: any) {
          console.error(`[pix-status] ❌ Erro XRS Booking para ${orderId}:`, e.message);
      }

      // Atualiza customerData com método de pagamento confirmado
      let updatedCustomerData = parsedData;
      try {
        updatedCustomerData = {
          ...parsedData,
          paymentMethod: 'PIX',
          cieloPaymentId: paymentId,
        };
      } catch (_) { }

      const finalStatus = isBookingOnRequest ? 'ON_REQUEST' : 'CONFIRMED_PREPAID';
      const finalOpStatus = xrsStatus;

      await prisma.localReservation.update({
          where: { id: reservaLocal.id },
          data: {
              resNumber,
              status: finalStatus,
              operationalStatus: finalOpStatus,
              customerData: JSON.stringify(updatedCustomerData),
          }
      });

      console.log(`[pix-status] ✅ Reserva ${resNumber} atualizada para ${finalStatus} (opStatus: ${finalOpStatus})`);

      // E-mail de confirmação (com proteções/franquias e acessórios) → só depois, a senha da conta nova.
      // Montagem das variáveis centralizada em reservationEmailVars (mesma do cartão/balcão).
      try {
         if (parsedData?.email) {
            const { sendReservationConfirmationEmail } = await import('@/lib/email/sendReservationConfirmationEmail');
            await sendReservationConfirmationEmail({
               customerData: updatedCustomerData,
               resNumber,
               amountInCents: cieloJson?.Payment?.Amount ?? reservaLocal.amountInCents,
               paymentMethod: 'PIX',
               isOnRequest: isBookingOnRequest,
               source: 'pix-status',
            });

            // Conta de convidado: criada só agora, com o pagamento confirmado, e DEPOIS da confirmação.
            const { ensureGuestAccountAndWelcome } = await import('@/lib/guestAccount');
            await ensureGuestAccountAndWelcome({ customerData: updatedCustomerData, resNumber });
         }
      } catch(e){
         console.error('[pix-status] Erro ao enviar e-mails pós-pagamento:', e);
      }

      // WhatsApp: PIX_AGRADECIMENTO
      try {
         if (parsedData?.telefone) {
            const booking = parsedData.booking || {};
            const totalBRLwa = `R$ ${(cieloJson.Payment.Amount / 100).toFixed(2).replace('.', ',')}`;
            import('@/lib/whatsapp/whatsappService').then(({ sendWhatsappTrigger }) => {
               sendWhatsappTrigger('PIX_AGRADECIMENTO', {
                  NOME: parsedData.nome || '',
                  SOBRENOME: parsedData.sobrenome || '',
                  NUMERO_RESERVA: resNumber,
                  VALOR_TOTAL: totalBRLwa,
                  CARRO: booking.car?.carCategoryName || booking.car?.name || '',
                  DATA_RETIRADA: booking.pickupDate || '',
                  DATA_DEVOLUCAO: booking.returnDate || '',
                  LOCAL_RETIRADA: booking.pickupStation || '',
                  LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
               }, parsedData.telefone);
            }).catch(err => console.error('[pix-status] WhatsApp agradecimento falhou:', err));
         }
      } catch(e){}

      return NextResponse.json({ status: 'PAID', resNumber });
      } finally {
         releasePixLock(lockKey);
      }

  } catch (error: any) {
     console.error(`[pix-status] ❌ Erro geral para orderId=${orderId}:`, error.message, error.stack);
     return NextResponse.json({ error: 'Erro ao buscar reserva local', detail: error.message }, { status: 500 });
  }
}
