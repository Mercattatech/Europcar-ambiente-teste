import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

// POST /api/commissions/[id] — Atualizar status da comissão (release, pay, cancel)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body.action; // 'release' | 'pay' | 'cancel'

    const commission = await prisma.commission.findUnique({ where: { id: params.id } });
    if (!commission) return NextResponse.json({ error: 'Comissão não encontrada' }, { status: 404 });

    let data: any = {};

    switch (action) {
      case 'release':
        if (commission.status !== 'FORECAST' && commission.status !== 'PENDING') {
          return NextResponse.json({ error: 'Comissão não pode ser liberada neste status.' }, { status: 400 });
        }
        data = { status: 'RELEASED', availableAt: new Date() };
        break;

      case 'pay':
        if (commission.status !== 'RELEASED') {
          return NextResponse.json({ error: 'Comissão precisa estar liberada para ser paga.' }, { status: 400 });
        }
        data = {
          status: 'PAID',
          paidAt: new Date(),
          paymentReference: body.paymentReference || null,
          notes: body.notes || null,
          paidBy: body.paidBy || null,
        };
        break;

      case 'cancel':
        if (commission.status === 'PAID') {
          return NextResponse.json({ error: 'Comissão já paga não pode ser cancelada diretamente.' }, { status: 400 });
        }
        data = { status: 'CANCELLED', notes: body.notes || 'Cancelada pelo administrador' };
        break;

      default:
        return NextResponse.json({ error: 'Ação inválida. Use: release, pay, cancel' }, { status: 400 });
    }

    const updated = await prisma.commission.update({
      where: { id: params.id },
      data,
      include: { partner: { select: { name: true } } },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[POST /api/commissions/[id]] Erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
