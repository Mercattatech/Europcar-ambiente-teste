import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { cancelXRSReservation, voidCieloPaymentForLocalReservation } from '@/lib/europcar/cancelService';
import { checkReservationAccess } from '@/lib/europcar/ownership';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;
    const resNumber = String(body.resNumber || '').trim();

    if (!resNumber) {
      return NextResponse.json({ error: 'resNumber é obrigatório para cancelamento' }, { status: 400 });
    }

    // Cliente logado (sessão) OU cliente sem login (nº da reserva + e-mail da compra)
    const session = await getServerSession(authOptions);
    const access = await checkReservationAccess(resNumber, {
      sessionEmail: session?.user?.email,
      guestEmail: email,
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { hasError, returnCode, errorMsg, raw: xrsResponse } = await cancelXRSReservation(resNumber);

    if (hasError) {

      // Se a Europcar já tiver cancelado previamente, a string de erro costuma ter "cancel" ou "already"
      const isAlreadyCancelled = errorMsg.toLowerCase().includes('cancel') || errorMsg.toLowerCase().includes('already');
      if (isAlreadyCancelled) {
        try {
          const localRes = await prisma.localReservation.update({
            where: { resNumber },
            data: { status: 'CANCELLED' }
          });
          voidCieloPaymentForLocalReservation(localRes.id).catch(() => {});

          if (localRes?.customerData) {
             // customerData é gravado como string JSON — sem o parse, cd.email era undefined e o e-mail nunca saía
             const cd: any = typeof localRes.customerData === 'string' ? JSON.parse(localRes.customerData) : localRes.customerData;
             if (cd.email) {
                const booking = cd.booking || {};
                const car = booking.car || {};
                const fmtD = (d: string) => d && d.length >= 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : d || '';
                const fmtT = (t: string) => /^\d{4}$/.test(t) ? `${t.slice(0,2)}:${t.slice(2,4)}` : '';
                const amtBRL = (localRes.amountInCents || 0) / 100;
                const valorBRL = `R$ ${amtBRL.toFixed(2).replace('.',',')}`;
                const rawAmt = parseFloat(car?.totalRateEstimate || car?.total || '0');
                const localCur = (car?.bookingCurrencyOfTotalRateEstimate || car?.currency || 'BRL').toUpperCase();
                let valorLocal = valorBRL;
                if (localCur !== 'BRL' && rawAmt > 0) {
                  try { valorLocal = new Intl.NumberFormat('pt-BR',{style:'currency',currency:localCur}).format(rawAmt); } catch { valorLocal = `${localCur} ${rawAmt.toFixed(2)}`; }
                }
                const valorTotal = localCur === 'BRL' ? valorLocal : `${valorLocal} (≈ ${valorBRL})`;
                const fmtPag: Record<string,string> = { BALCAO:'Pagamento no Balcão', PIX:'PIX', CREDIT:'Cartão de Crédito', VOUCHER:'Voucher ETO (Faturado)' };
                const cancelResult = await sendTransactionalEmail(cd.email, 'CANCELAMENTO', {
                   NOME: cd.nome || '',
                   SOBRENOME: cd.sobrenome || '',
                   EMAIL: cd.email || '',
                   TELEFONE: cd.telefone || '',
                   NUMERO_RESERVA: resNumber,
                   CARRO: car.carCategoryName || car.carCategorySample || car.name || '',
                   CATEGORIA_CARRO: car.carCategoryCode || car.acrissCode || '',
                   DATA_RETIRADA: fmtD(booking.pickupDate || ''),
                   HORARIO_RETIRADA: fmtT(booking.pickupTime || ''),
                   LOCAL_RETIRADA: booking.pickupStation || '',
                   DATA_DEVOLUCAO: fmtD(booking.returnDate || ''),
                   HORARIO_DEVOLUCAO: fmtT(booking.returnTime || ''),
                   LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
                   VALOR_LOCAL: valorLocal,
                   VALOR_BRL: valorBRL,
                   VALOR_TOTAL: valorTotal,
                   MOEDA: localCur,
                   FORMA_PAGAMENTO: fmtPag[cd.paymentMethod || ''] || cd.paymentMethod || '',
                });
                if (!cancelResult.success && cancelResult.error === 'Template não encontrado') {
                  const { sendCancellationEmail } = await import('@/lib/email/sendCancellationEmail');
                  await sendCancellationEmail({
                    toEmail: cd.email, customerName: `${cd.nome||''} ${cd.sobrenome||''}`.trim(),
                    resNumber, carName: car.carCategoryName || car.carCategorySample || '',
                    pickupStation: booking.pickupStation || '', returnStation: booking.returnStation || booking.pickupStation || '',
                    pickupDate: booking.pickupDate || '', returnDate: booking.returnDate || '',
                    paymentMethod: cd.paymentMethod || '', totalBRL: amtBRL,
                  });
                }
             }
          }
        } catch (dbErr) {}
        
        return NextResponse.json({
          success: true,
          returnCode,
          error: "Reserva já estava cancelada na Europcar.",
          raw: xrsResponse
        });
      }

      return NextResponse.json({
        success: false,
        returnCode,
        error: errorMsg,
        raw: xrsResponse
      }, { status: 400 });
    }

    // Se cancelou com sucesso na Europcar, atualiza o status local para CANCELLED
    if (!hasError) {
      try {
        const localRes = await prisma.localReservation.update({
          where: { resNumber },
          data: { status: 'CANCELLED' }
        });
        voidCieloPaymentForLocalReservation(localRes.id).catch(() => {});

        // Trigger Email
        if (localRes?.customerData) {
           // customerData é gravado como string JSON — sem o parse, cd.email era undefined e o e-mail nunca saía
           const cd: any = typeof localRes.customerData === 'string' ? JSON.parse(localRes.customerData) : localRes.customerData;
           if (cd.email) {
              const booking = cd.booking || {};
              const car = booking.car || {};
              const fmtD = (d: string) => d && d.length >= 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : d || '';
              const fmtT = (t: string) => /^\d{4}$/.test(t) ? `${t.slice(0,2)}:${t.slice(2,4)}` : '';
              const amtBRL = (localRes.amountInCents || 0) / 100;
              const valorBRL = `R$ ${amtBRL.toFixed(2).replace('.',',')}`;
              const rawAmt = parseFloat(car?.totalRateEstimate || car?.total || '0');
              const localCur = (car?.bookingCurrencyOfTotalRateEstimate || car?.currency || 'BRL').toUpperCase();
              let valorLocal = valorBRL;
              if (localCur !== 'BRL' && rawAmt > 0) {
                try { valorLocal = new Intl.NumberFormat('pt-BR',{style:'currency',currency:localCur}).format(rawAmt); } catch { valorLocal = `${localCur} ${rawAmt.toFixed(2)}`; }
              }
              const valorTotal = localCur === 'BRL' ? valorLocal : `${valorLocal} (≈ ${valorBRL})`;
              const fmtPag: Record<string,string> = { BALCAO:'Pagamento no Balcão', PIX:'PIX', CREDIT:'Cartão de Crédito', VOUCHER:'Voucher ETO (Faturado)' };
              const cancelResult2 = await sendTransactionalEmail(cd.email, 'CANCELAMENTO', {
                 NOME: cd.nome || '',
                 SOBRENOME: cd.sobrenome || '',
                 EMAIL: cd.email || '',
                 TELEFONE: cd.telefone || '',
                 NUMERO_RESERVA: resNumber,
                 CARRO: car.carCategoryName || car.carCategorySample || car.name || '',
                 CATEGORIA_CARRO: car.carCategoryCode || car.acrissCode || '',
                 DATA_RETIRADA: fmtD(booking.pickupDate || ''),
                 HORARIO_RETIRADA: fmtT(booking.pickupTime || ''),
                 LOCAL_RETIRADA: booking.pickupStation || '',
                 DATA_DEVOLUCAO: fmtD(booking.returnDate || ''),
                 HORARIO_DEVOLUCAO: fmtT(booking.returnTime || ''),
                 LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
                 VALOR_LOCAL: valorLocal,
                 VALOR_BRL: valorBRL,
                 VALOR_TOTAL: valorTotal,
                 MOEDA: localCur,
                 FORMA_PAGAMENTO: fmtPag[cd.paymentMethod || ''] || cd.paymentMethod || '',
              });
              if (!cancelResult2.success && cancelResult2.error === 'Template não encontrado') {
                const { sendCancellationEmail } = await import('@/lib/email/sendCancellationEmail');
                await sendCancellationEmail({
                  toEmail: cd.email, customerName: `${cd.nome||''} ${cd.sobrenome||''}`.trim(),
                  resNumber, carName: car.carCategoryName || car.carCategorySample || '',
                  pickupStation: booking.pickupStation || '', returnStation: booking.returnStation || booking.pickupStation || '',
                  pickupDate: booking.pickupDate || '', returnDate: booking.returnDate || '',
                  paymentMethod: cd.paymentMethod || '', totalBRL: amtBRL,
                });
              }
           }
        }
      } catch (dbErr) {
        console.error("Erro ao atualizar status local para CANCELLED:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      returnCode,
      raw: xrsResponse
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar reserva no XRS' },
      { status: 500 }
    );
  }
}
