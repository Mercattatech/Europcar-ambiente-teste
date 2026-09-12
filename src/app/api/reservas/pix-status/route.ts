import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { executeXRSBooking } from '@/lib/europcar/bookXRS';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

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

     if (reservaLocal.status === 'CONFIRMED_PREPAID' && reservaLocal.resNumber) {
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

     console.log(`[pix-status] Consultando Cielo paymentId=${paymentId} | sandbox=${cieloConfig.isSandbox}`);

     const CIELO_QUERY_URL = cieloConfig.isSandbox 
        ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`
        : `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;

     const resCielo = await fetch(CIELO_QUERY_URL, {
         headers: {
            "MerchantId": cieloConfig.merchantId,
            "MerchantKey": cieloConfig.merchantKey
         }
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
        console.log(`[pix-status] PIX ainda não pago. Status: ${cieloPaymentStatus} (${statusNames[cieloPaymentStatus] || 'Unknown'})`);
        return NextResponse.json({ status: 'PENDING', cieloStatus: cieloPaymentStatus, cieloStatusName: statusNames[cieloPaymentStatus] || 'Unknown' });
     }

     // ══════════════════════════════════════════════════════════════
     // PIX PAGO! Processar reserva XRS + atualizar banco
     // ══════════════════════════════════════════════════════════════
     console.log(`[pix-status] ✅ PIX PAGO! Processando reserva XRS para ${orderId}...`);

     let resNumber = reservaLocal.merchantOrderId;
     try {
         const { resNumber: europcarResNumber } = await executeXRSBooking({
             bookingData: parsedData.booking,
             customerData: parsedData,
             paymentData: { method: 'PIX', amountInCents: reservaLocal.amountInCents, merchantOrderId: reservaLocal.merchantOrderId },
             xrsEquipment: parsedData.booking?.xrsEquipment || [],
         });
         if (europcarResNumber) {
            resNumber = europcarResNumber;
            console.log(`[pix-status] ✅ Reserva XRS criada: ${resNumber}`);
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

     await prisma.localReservation.update({
         where: { id: reservaLocal.id },
         data: {
             resNumber,
             status: 'CONFIRMED_PREPAID',
             customerData: JSON.stringify(updatedCustomerData),
         }
     });

     console.log(`[pix-status] ✅ Reserva ${resNumber} atualizada para CONFIRMED_PREPAID`);

     // Trigger Email PIX Sucesso
     try {
        if (parsedData?.email) {
           const fmtDate = (d: string) => d && d.length >= 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : d || '';
           const fmtTime = (d: string) => { if (!d) return ''; const t = d.indexOf('T'); return t >= 0 && d.length >= t+5 ? `${d.slice(t+1,t+3)}:${d.slice(t+3,t+5)}` : ''; };
           const booking = parsedData.booking || {};
           const totalBRL = (cieloJson.Payment.Amount / 100).toFixed(2).replace('.', ',');

           import('@/lib/emailService').then(({ sendTransactionalEmail }) => {
              sendTransactionalEmail(parsedData.email, 'RESERVA_SUCESSO', {
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
                 HORARIO_RETIRADA: fmtTime(booking.pickupDate || '') || booking.pickupTime || '',
                 LOCAL_RETIRADA: booking.pickupStation || '',
                 DATA_DEVOLUCAO: fmtDate(booking.returnDate || ''),
                 HORARIO_DEVOLUCAO: fmtTime(booking.returnDate || '') || booking.returnTime || '',
                 LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
                 LISTA_PROTECOES: '',
                 LISTA_EXTRAS: '',
              }).catch(console.error);
           });
        }
     } catch(e){}

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

  } catch (error: any) {
     console.error(`[pix-status] ❌ Erro geral para orderId=${orderId}:`, error.message, error.stack);
     return NextResponse.json({ error: 'Erro ao buscar reserva local', detail: error.message }, { status: 500 });
  }
}
