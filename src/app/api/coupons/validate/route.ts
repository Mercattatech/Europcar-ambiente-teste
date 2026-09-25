import { NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/coupon/validateCoupon';
export const dynamic = 'force-dynamic';

// POST /api/coupons/validate — Validar cupom (público, usado no checkout)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await validateCoupon({
      code: body.code,
      customerEmail: body.customerEmail,
      orderValue: body.orderValue ? parseFloat(body.orderValue) : 0,
      carCategory: body.carCategory,
    });

    // Não expor dados internos do cupom para o público
    return NextResponse.json({
      valid: result.valid,
      discountAmount: result.discountAmount,
      finalValue: result.finalValue,
      discountLabel: result.discountLabel,
      message: result.message,
      errorCode: result.errorCode,
    });
  } catch (err: any) {
    console.error('[POST /api/coupons/validate] Erro:', err);
    return NextResponse.json({ valid: false, message: 'Erro ao validar cupom.', errorCode: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
