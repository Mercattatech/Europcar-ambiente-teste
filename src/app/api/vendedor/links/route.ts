import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getActor, PAYMENT_LINK_TTL_MS } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

/** Cria um link de pagamento a partir do checkout do vendedor. */
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor || !actor.id) {
    return NextResponse.json({ error: 'Faça login como vendedor para gerar links.' }, { status: 401 });
  }
  const { bookingData, customerData, amountInCents } = await req.json();

  if (!bookingData || !customerData?.nome || !customerData?.email) {
    return NextResponse.json({ error: 'Preencha ao menos nome e e-mail do cliente.' }, { status: 400 });
  }
  if (!String(customerData.email).includes('@')) {
    return NextResponse.json({ error: 'E-mail do cliente inválido.' }, { status: 400 });
  }

  // Nunca persistir dados sensíveis de cartão
  const { creditCard: _cc, cvv: _cvv, cardNumber: _cn, ...safeCustomer } = customerData;

  const seller = actor.kind === 'VENDEDOR' ? actor : null;
  const token = crypto.randomBytes(18).toString('base64url');
  const link = await prisma.paymentLink.create({
    data: {
      token,
      sellerId: actor.id,
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

  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || new URL(req.url).origin;
  return NextResponse.json({
    token: link.token,
    url: `${origin}/pagar/${link.token}`,
    expiresAt: link.expiresAt,
  });
}

/** Lista os links do vendedor logado (admin vê todos). */
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const links = await prisma.paymentLink.findMany({
    where: actor.kind === 'VENDEDOR' ? { sellerId: actor.id } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, token: true, customerName: true, status: true, expiresAt: true, resNumber: true, createdAt: true },
  });
  return NextResponse.json(links);
}
