import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pix-retry/[id]
 * Gera um novo QR Code PIX na Cielo para uma reserva pendente.
 * [id] = merchantOrderId da reserva local.
 * 
 * Funciona sem login (link público via merchantOrderId).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const merchantOrderId = params.id;
  if (!merchantOrderId) {
    return NextResponse.json({ error: 'ID não informado' }, { status: 400 });
  }

  try {
    // 1. Busca a reserva pendente
    const reserva = await prisma.localReservation.findFirst({
      where: { merchantOrderId, status: 'PENDING_PIX' },
    });

    if (!reserva) {
      return NextResponse.json({ 
        error: 'Reserva não encontrada ou já confirmada.',
        status: 'NOT_FOUND'
      }, { status: 404 });
    }

    // 2. Carrega config Cielo
    const cieloConfig = await prisma.cieloConfig.findFirst();
    if (!cieloConfig) {
      return NextResponse.json({ error: 'Configuração de pagamento não encontrada' }, { status: 500 });
    }

    const isSandbox = cieloConfig.isSandbox === true;
    const CIELO_API_URL = isSandbox
      ? 'https://apisandbox.cieloecommerce.cielo.com.br/1/sales/'
      : 'https://api.cieloecommerce.cielo.com.br/1/sales/';

    const cieloHeaders = {
      'Content-Type': 'application/json',
      'MerchantId': String(cieloConfig.merchantId || '').trim(),
      'MerchantKey': String(cieloConfig.merchantKey || '').trim(),
    };

    // Parse customer data
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(reserva.customerData as string);
    } catch {}

    // 3. Gera novo PIX na Cielo
    const newMerchantOrderId = `${merchantOrderId}-R${Date.now().toString(36)}`;
    const pixPayload = {
      MerchantOrderId: newMerchantOrderId,
      ...(cieloConfig.establishmentCode && { EstablishmentCode: cieloConfig.establishmentCode }),
      ...(cieloConfig.merchantName && { MerchantName: cieloConfig.merchantName }),
      MerchantCategoryCode: cieloConfig.mcc || '7512',
      Customer: {
        Name: `${parsedData.nome || ''} ${parsedData.sobrenome || ''}`.trim() || 'Cliente',
        Identity: parsedData.cpf || '',
      },
      Payment: {
        Type: 'Pix',
        Amount: reserva.amountInCents,
      },
    };

    const resCielo = await fetch(CIELO_API_URL, {
      method: 'POST',
      headers: cieloHeaders,
      body: JSON.stringify(pixPayload),
    });

    const rawText = await resCielo.text();

    // Log the request
    prisma.logCielo.create({
      data: {
        endpoint: `${CIELO_API_URL} (PIX RETRY)`,
        payload: JSON.stringify(pixPayload),
        response: rawText || `[Vazio] HTTP ${resCielo.status}`,
      },
    }).catch(console.error);

    let cieloJson: any = {};
    try { cieloJson = JSON.parse(rawText); } catch {}

    if (!resCielo.ok || !cieloJson.Payment?.QrCodeString) {
      const errorMsg = cieloJson.Payment?.ReturnMessage 
        || (Array.isArray(cieloJson) ? cieloJson.map((e: any) => e.Message).join(', ') : '')
        || `HTTP ${resCielo.status}`;
      return NextResponse.json({ error: `Erro ao gerar novo PIX: ${errorMsg}` }, { status: 500 });
    }

    // 4. Atualiza reserva com novo paymentId
    const newPaymentId = cieloJson.Payment.PaymentId;
    const updatedCustomerData = {
      ...parsedData,
      paymentId: newPaymentId,
      pixRetryAt: new Date().toISOString(),
      pixRetryMerchantOrderId: newMerchantOrderId,
    };

    await prisma.localReservation.update({
      where: { id: reserva.id },
      data: {
        customerData: JSON.stringify(updatedCustomerData),
      },
    });

    console.log(`[pix-retry] ✅ Novo PIX gerado para ${merchantOrderId} → paymentId: ${newPaymentId}`);

    // 5. Retorna dados do novo PIX
    return NextResponse.json({
      success: true,
      qrCodeBase64: cieloJson.Payment.QrCodeBase64Image,
      qrCodeString: cieloJson.Payment.QrCodeString,
      paymentId: newPaymentId,
      amount: reserva.amountInCents,
      merchantOrderId: reserva.merchantOrderId,
    });
  } catch (error: any) {
    console.error('[pix-retry] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
