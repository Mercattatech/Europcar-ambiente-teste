import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { checkAdmin } from '@/lib/checkAdmin';
import prisma from '@/lib/prisma';
import { executeXRSBooking } from '@/lib/europcar/bookXRS';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reservas/cadastrar-manual
 *
 * Cria ou atualiza uma reserva manual no sistema a partir do painel administrativo.
 * Suporta:
 *   1. Cadastro de reserva manual direto (com ou sem envio imediato ao GreenWay / GW).
 *   2. Cadastro/importação de reserva previamente consultada e sincronizada do GreenWay por número.
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = await checkAdmin().catch(() => false);
    if (!isAdmin || !session?.user) {
      return NextResponse.json({ error: 'Não autorizado. Apenas administradores.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      resNumber,
      nome,
      sobrenome,
      email,
      telefone,
      cpf,
      paisEmissao = 'BR',
      pickupStation,
      returnStation,
      pickupDate,
      pickupTime = '1000',
      returnDate,
      returnTime = '1000',
      carCategory,
      carName,
      amountBRL,
      amountCounter,
      taxaDevolucao,
      paymentMethod = 'BALCAO',
      status: explicitStatus,
      operationalStatus: explicitOpStatus,
      sendToGW = false,
      contractID = '57269673',
      overwriteIfExists = false,
    } = body;

    // Validações básicas
    if (!nome || !sobrenome) {
      return NextResponse.json({ error: 'Nome e sobrenome são obrigatórios.' }, { status: 400 });
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'E-mail válido é obrigatório.' }, { status: 400 });
    }
    if (!pickupStation || !pickupDate) {
      return NextResponse.json({ error: 'Estação e data de retirada são obrigatórias.' }, { status: 400 });
    }
    if (!returnDate) {
      return NextResponse.json({ error: 'Data de devolução é obrigatória.' }, { status: 400 });
    }
    if (!carCategory) {
      return NextResponse.json({ error: 'Categoria do veículo (ex: EDMR) é obrigatória.' }, { status: 400 });
    }

    // Normalização de datas e horários
    const cleanPickupDate = String(pickupDate).replace(/\D/g, '');
    const cleanReturnDate = String(returnDate).replace(/\D/g, '');
    const cleanPickupTime = String(pickupTime).replace(/\D/g, '').padEnd(4, '0').slice(0, 4) || '1000';
    const cleanReturnTime = String(returnTime).replace(/\D/g, '').padEnd(4, '0').slice(0, 4) || '1000';
    const cleanPickupStation = String(pickupStation).trim().toUpperCase();
    const cleanReturnStation = String(returnStation || pickupStation).trim().toUpperCase();
    const cleanCarCategory = String(carCategory).trim().toUpperCase();
    const cleanResNumber = resNumber && typeof resNumber === 'string' && resNumber.trim() ? resNumber.trim() : null;

    if (cleanPickupDate.length !== 8 || cleanReturnDate.length !== 8) {
      return NextResponse.json({ error: 'Datas devem estar no formato YYYYMMDD ou YYYY-MM-DD.' }, { status: 400 });
    }

    // Cálculo do valor em centavos
    const numAmountBRL = parseFloat(String(amountBRL || 0)) || 0;
    const amountInCents = Math.round(numAmountBRL * 100);

    // Resolução de status inicial
    let finalStatus = explicitStatus;
    if (!finalStatus) {
      if (paymentMethod === 'BALCAO') finalStatus = 'CONFIRMED_NON_PREPAID';
      else if (paymentMethod === 'PIX') finalStatus = 'PENDING_PIX';
      else if (paymentMethod === 'CREDIT') finalStatus = 'CONFIRMED_PREPAID';
      else if (paymentMethod === 'VOUCHER') finalStatus = 'CONFIRMED_NON_PREPAID';
      else finalStatus = 'CONFIRMED_NON_PREPAID';
    }

    // Resolução de status operacional inicial
    const finalOpStatus = explicitOpStatus || (finalStatus === 'ON_REQUEST' ? 'R' : 'CF');

    const numTaxaDevolucao = parseFloat(String(taxaDevolucao || 0)) || 0;
    const numAmountCounter = parseFloat(String(amountCounter || 0)) || 0;

    // Montar objeto booking
    const booking = {
      pickupStation: cleanPickupStation,
      returnStation: cleanReturnStation,
      pickupDate: cleanPickupDate,
      pickupTime: cleanPickupTime,
      returnDate: cleanReturnDate,
      returnTime: cleanReturnTime,
      contractID: contractID || '57269673',
      taxaDevolucao: numTaxaDevolucao > 0 ? numTaxaDevolucao : undefined,
      oneWayFee: numTaxaDevolucao > 0 ? numTaxaDevolucao : undefined,
      car: {
        carCategoryCode: cleanCarCategory,
        name: carName || cleanCarCategory,
        totalRateEstimate: String(numAmountBRL),
        currency: 'BRL',
      },
    };

    // Montar customerData persistido
    const customerData = {
      nome: String(nome).trim(),
      sobrenome: String(sobrenome).trim(),
      email: String(email).trim().toLowerCase(),
      telefone: String(telefone || '').trim(),
      cpf: String(cpf || '').trim(),
      paisEmissao: String(paisEmissao || 'BR').trim().toUpperCase(),
      paymentMethod,
      amountCounter: numAmountCounter > 0 ? numAmountCounter : undefined,
      taxaDevolucao: numTaxaDevolucao > 0 ? numTaxaDevolucao : undefined,
      isManual: true,
      createdVia: cleanResNumber ? 'GW_SYNC_IMPORT' : 'MANUAL_PANEL',
      createdAdmin: session.user.email,
      createdAt: new Date().toISOString(),
      booking,
    };

    // Verificar se já existe por resNumber
    let existingReservation = null;
    if (cleanResNumber) {
      existingReservation = await prisma.localReservation.findFirst({
        where: {
          OR: [
            { resNumber: cleanResNumber },
            { merchantOrderId: cleanResNumber },
          ],
        },
      });
    }

    let savedReservation: any;

    if (existingReservation) {
      if (!overwriteIfExists) {
        return NextResponse.json({
          error: `Reserva ${cleanResNumber} já cadastrada no sistema. Utilize a opção de atualizar se desejar sobrescrever.`,
          existingId: existingReservation.id,
        }, { status: 409 });
      }

      // Atualiza a reserva existente
      savedReservation = await prisma.localReservation.update({
        where: { id: existingReservation.id },
        data: {
          resNumber: cleanResNumber,
          status: finalStatus,
          operationalStatus: finalOpStatus,
          amountInCents: amountInCents > 0 ? amountInCents : existingReservation.amountInCents,
          customerData: JSON.stringify(customerData),
        },
      });

      return NextResponse.json({
        success: true,
        action: 'updated',
        reservation: savedReservation,
        message: `Reserva ${cleanResNumber} atualizada com sucesso!`,
      });
    }

    // Criar nova reserva
    const merchantOrderId = cleanResNumber ? `GW-${cleanResNumber}` : `MANUAL-${Date.now().toString().slice(-8)}`;

    savedReservation = await prisma.localReservation.create({
      data: {
        resNumber: cleanResNumber,
        merchantOrderId,
        amountInCents,
        status: finalStatus,
        operationalStatus: finalOpStatus,
        customerData: JSON.stringify(customerData),
      },
    });

    // Se solicitou envio imediato ao GreenWay e ainda não possui resNumber
    let gwSent = false;
    let gwError: string | null = null;
    let gwResNumber: string | null = null;

    if (sendToGW && !cleanResNumber) {
      try {
        console.log(`[cadastrar-manual] Enviando reserva manual ${savedReservation.id} ao GreenWay...`);
        const xrsResult = await executeXRSBooking({
          bookingData: booking,
          customerData,
          paymentData: {
            method: paymentMethod,
            amountInCents,
            merchantOrderId,
          },
        });

        if (xrsResult?.resNumber) {
          gwSent = true;
          gwResNumber = xrsResult.resNumber;
          const updatedOpStatus = xrsResult.isOnRequest ? 'R' : 'CF';
          const updatedStatus = xrsResult.isOnRequest ? 'ON_REQUEST' : savedReservation.status;

          savedReservation = await prisma.localReservation.update({
            where: { id: savedReservation.id },
            data: {
              resNumber: gwResNumber,
              operationalStatus: updatedOpStatus,
              status: updatedStatus,
            },
          });
        }
      } catch (err: any) {
        console.error('[cadastrar-manual] Falha ao enviar ao GreenWay no cadastro:', err.message);
        gwError = err.message || 'Erro ao comunicar com o GreenWay Europcar';
      }
    }

    return NextResponse.json({
      success: true,
      action: 'created',
      reservation: savedReservation,
      gwSent,
      gwResNumber,
      gwError,
      message: gwSent
        ? `Reserva criada e enviada ao GreenWay com sucesso! Nº GW: ${gwResNumber}`
        : gwError
        ? `Reserva salva localmente, mas houve erro ao enviar ao GW: ${gwError}`
        : `Reserva manual cadastrada com sucesso!`,
    });

  } catch (error: any) {
    console.error('[cadastrar-manual] Erro:', error);
    return NextResponse.json({
      error: 'Erro interno ao cadastrar reserva: ' + (error.message || String(error)),
    }, { status: 500 });
  }
}
