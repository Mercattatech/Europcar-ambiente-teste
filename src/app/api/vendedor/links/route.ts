import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getActor, PAYMENT_LINK_TTL_MS } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

/**
 * Cria um link de pagamento compartilhável a partir do checkout.
 * - Se o usuário logado for vendedor (VENDEDOR ou VENDEDOR_ADMIN): vincula sellerId e regra de comissão.
 * - Se for usuário comum, visitante ou admin sem vínculo de vendedor: cria o link sem vendedor (sellerId = null) e sem comissão.
 */
export async function POST(req: Request) {
  try {
    const actor = await getActor().catch(() => null);
    const { bookingData, customerData, amountInCents } = await req.json();

    if (!bookingData || !customerData?.nome || !customerData?.email) {
      return NextResponse.json({ error: 'Preencha ao menos nome e e-mail do condutor.' }, { status: 400 });
    }
    if (!String(customerData.email).includes('@')) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }

    // Nunca persistir dados sensíveis de cartão
    const { creditCard: _cc, cvv: _cvv, cardNumber: _cn, ...safeCustomer } = customerData;

    const seller = actor?.isSeller && actor.id ? actor : null;
    const token = crypto.randomBytes(18).toString('base64url');
    const link = await prisma.paymentLink.create({
      data: {
        token,
        sellerId: seller ? seller.id : null,
        customerName: `${customerData.nome} ${customerData.sobrenome || ''}`.trim(),
        customerEmail: String(customerData.email).trim(),
        customerPhone: customerData.telefone || null,
        bookingData,
        customerData: safeCustomer,
        amountInCents: Math.max(0, Math.round(Number(amountInCents) || 0)),
        expiresAt: new Date(Date.now() + PAYMENT_LINK_TTL_MS),
        commissionType: seller?.commissionType ?? null,
        commissionRate: seller?.commissionValue ?? null,
      },
    });

    // Domínio real acessado (NEXTAUTH_URL pode apontar para o domínio interno do Coolify)
    const fwdHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const fwdProto = req.headers.get('x-forwarded-proto') || 'https';
    const origin = fwdHost ? `${fwdProto}://${fwdHost}` : new URL(req.url).origin;
    return NextResponse.json({
      token: link.token,
      url: `${origin}/pagar/${link.token}`,
      expiresAt: link.expiresAt,
      attributedToSeller: !!seller,
    });
  } catch (e: any) {
    console.error('[links] POST falhou:', e?.message);
    return NextResponse.json({ error: 'Erro ao gerar link de pagamento. Tente novamente.' }, { status: 500 });
  }
}

/** Lista os links do vendedor logado (admin vê todos os links de vendedores). */
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const links = await prisma.paymentLink.findMany({
    where: actor.isAdmin ? { sellerId: { not: null } } : { sellerId: actor.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, token: true, customerName: true, status: true, expiresAt: true, resNumber: true, createdAt: true },
  });
  return NextResponse.json(links);
}
