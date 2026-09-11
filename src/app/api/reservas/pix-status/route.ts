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
         return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
     }

     if (reservaLocal.status === 'CONFIRMED_PREPAID' && reservaLocal.resNumber) {
         return NextResponse.json({ status: 'PAID', resNumber: reservaLocal.resNumber });
     }

     if (reservaLocal.status === 'PENDING_PIX') {
         // Consulta API da Cielo para ver se pagou
         const cieloConfig = await prisma.cieloConfig.findFirst();
         if (!cieloConfig) return NextResponse.json({ error: 'chaves da cielo falha' }, { status: 500 });
         
         const parsedData: any = JSON.parse(reservaLocal.customerData as string);
         const paymentId = parsedData.paymentId;

         if (paymentId) {
             const CIELO_API_URL = cieloConfig.isSandbox 
                ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`
                : `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;
             const resCielo = await fetch(CIELO_API_URL, {
                 headers: {
                    "MerchantId": cieloConfig.merchantId,
                    "MerchantKey": cieloConfig.merchantKey
                 }
             });

             const cieloJson = await resCielo.json();
             
             // Status 2 = Paid, Status 12 = Pending, Status 1 = Authorized (for Pix 2 meaning Paid)
             // Let's also consider 1 or 2 as approved/paid depending on sandbox
             if (cieloJson.Payment && (cieloJson.Payment.Status === 2 || cieloJson.Payment.Status === 1)) { 
                 let resNumber = reservaLocal.merchantOrderId;
                 try {
                     const { resNumber: europcarResNumber } = await executeXRSBooking({
                         bookingData: parsedData.booking,
                         customerData: parsedData,
                         paymentData: { method: 'PIX', amountInCents: reservaLocal.amountInCents, merchantOrderId: reservaLocal.merchantOrderId },
                         xrsEquipment: parsedData.booking?.xrsEquipment || [],
                     });
                     if (europcarResNumber) resNumber = europcarResNumber;
                 } catch (e: any) {
                     console.error("PIX-STATUS: Error executing XRS Booking", e.message);
                 }

                 // Atualiza o JSON de customerData para persistir o método de pagamento real
                 // Isso permite que o painel admin exiba "PIX" em vez de apenas o status genérico
                 let updatedCustomerData = parsedData;
                 try {
                   updatedCustomerData = {
                     ...parsedData,
                     paymentMethod: 'PIX',       // método de pagamento confirmado
                     cieloPaymentId: paymentId,  // PaymentId Cielo para rastreabilidade
                   };
                 } catch (_) { /* mantém parsedData original se algo falhar */ }

                 await prisma.localReservation.update({
                     where: { id: reservaLocal.id },
                     data: {
                         resNumber,
                         status: 'CONFIRMED_PREPAID',
                         customerData: JSON.stringify(updatedCustomerData),
                     }
                 });
                 
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
                 return NextResponse.json({ status: 'PAID', resNumber });
             } else {
                 return NextResponse.json({ status: 'PENDING' });
             }
         }
     }

     return NextResponse.json({ status: 'PENDING' });
  } catch (error: any) {
     return NextResponse.json({ error: 'Erro ao buscar reserva local' }, { status: 500 });
  }
}
