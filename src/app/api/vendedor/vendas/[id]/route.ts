import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getActor } from '@/lib/sellers';

export const dynamic = 'force-dynamic';

/** Admin: edita o valor, status e observação da comissão de uma venda. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor?.kind !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json();
  const data: any = {};
  if (b.commissionAmount !== undefined) {
    const v = Number(b.commissionAmount);
    if (!isFinite(v) || v < 0) return NextResponse.json({ error: 'Valor de comissão inválido' }, { status: 400 });
    data.commissionAmount = Math.round(v * 100) / 100;
  }
  if (b.commissionStatus !== undefined) {
    if (!['PENDING', 'APPROVED', 'PAID', 'CANCELLED'].includes(b.commissionStatus)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }
    data.commissionStatus = b.commissionStatus;
    data.commissionPaidAt = b.commissionStatus === 'PAID' ? new Date() : null;
  }
  if (b.commissionNotes !== undefined) data.commissionNotes = b.commissionNotes || null;

  const link = await prisma.paymentLink.findUnique({ where: { id: params.id } });
  if (!link) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });
  await prisma.paymentLink.update({ where: { id: params.id }, data });
  return NextResponse.json({ success: true });
}

