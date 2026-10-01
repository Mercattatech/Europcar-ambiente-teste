import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cielo/log-error
 * Registra erros de client-side 3DS (ex: falha ao carregar script, recusa do banco no 3DS,
 * timeout de rede, pop-up bloqueado) na tabela LogCielo do banco de dados para visibilidade no Painel Admin,
 * trazendo o Nome do Cliente, WhatsApp, E-mail, BIN do cartão e o motivo exato.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      event,
      details,
      cardBin,
      userAgent,
      orderId,
      customerName,
      customerEmail,
      customerPhone
    } = body;

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'Desconhecido';

    const safePayload = {
      event: event || 'UNKNOWN_3DS_EVENT',
      customerName: customerName || 'Não Informado',
      customerEmail: customerEmail || 'Não Informado',
      customerPhone: customerPhone || 'Não Informado',
      cardBin: cardBin ? `${String(cardBin).slice(0, 6)}******` : null,
      orderId: orderId || null,
      clientIp: ip,
      userAgent: userAgent || request.headers.get('user-agent') || 'Unknown Browser',
      details: details || null,
      timestamp: new Date().toISOString()
    };

    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details || {});
    const responseSummary = `Cliente: ${safePayload.customerName} | Whats: ${safePayload.customerPhone} | Email: ${safePayload.customerEmail} | Detalhes: ${detailsStr}`;

    await prisma.logCielo.create({
      data: {
        endpoint: `[3DS Client Error] ${event || '3DS_EVENT'}`,
        payload: JSON.stringify(safePayload),
        response: responseSummary
      }
    });

    // Registra na nova central de recusas /painel/logs (transaction_rejection_logs)
    const { registerFailedTransaction } = await import('@/lib/rejectionService');
    await registerFailedTransaction({
      provider: 'Cielo / 3DS Lynx',
      paymentMethod: 'CREDIT',
      amount: 0,
      customerName: safePayload.customerName !== 'Não Informado' ? safePayload.customerName : undefined,
      customerEmail: safePayload.customerEmail !== 'Não Informado' ? safePayload.customerEmail : undefined,
      customerPhone: safePayload.customerPhone !== 'Não Informado' ? safePayload.customerPhone : undefined,
      merchantOrderId: safePayload.orderId || undefined,
      endpoint: `[3DS Client Error] ${event || '3DS_EVENT'}`,
      rawPayload: safePayload,
      returnCode: event === 'AbortedByCardVerification' ? '33' : (event || '3DS_ERROR'),
      returnMessage: detailsStr || 'Falha ou desafio 3DS recusado pelo emissor/portador',
      is3dsError: true
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[log-error] Falha ao gravar log 3DS:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
