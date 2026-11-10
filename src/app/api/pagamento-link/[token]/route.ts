import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Público: devolve a cotação congelada do link para o cliente pagar no checkout normal. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const link = await prisma.paymentLink.findUnique({ where: { token: params.token } });
  if (!link) return NextResponse.json({ error: 'Link não encontrado.' }, { status: 404 });
  if (link.status === 'USED') return NextResponse.json({ error: 'Este link já foi utilizado e a reserva está concluída.', code: 'USED' }, { status: 410 });
  if (link.status === 'CANCELLED') return NextResponse.json({ error: 'Este link foi cancelado. Peça um novo link ao seu consultor.', code: 'CANCELLED' }, { status: 410 });
  if (link.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Este link expirou. Peça um novo link ao seu consultor.', code: 'EXPIRED' }, { status: 410 });
  }
  return NextResponse.json({
    token: link.token,
    bookingData: link.bookingData,
    customerData: link.customerData,
  });
}
