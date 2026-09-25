import { NextResponse } from 'next/server';
import { applyCoupon } from '@/lib/coupon/applyCoupon';
export const dynamic = 'force-dynamic';

// POST /api/coupons/apply — Aplicar cupom a uma reserva (chamado internamente pela rota de reservas)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await applyCoupon({
      code: body.code,
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      reservationId: body.reservationId,
      resNumber: body.resNumber,
      orderValue: body.orderValue ? parseFloat(body.orderValue) : 0,
      carCategory: body.carCategory,
    });

    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch (err: any) {
    console.error('[POST /api/coupons/apply] Erro:', err);
    return NextResponse.json({ valid: false, message: 'Erro ao aplicar cupom.' }, { status: 500 });
  }
}
