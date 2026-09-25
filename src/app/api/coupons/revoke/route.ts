import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/checkAdmin';
import { revokeUsage } from '@/lib/coupon/applyCoupon';
export const dynamic = 'force-dynamic';

// POST /api/coupons/revoke — Estornar uso de cupom
export async function POST(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { usageId } = await req.json();
    if (!usageId) {
      return NextResponse.json({ error: 'usageId é obrigatório.' }, { status: 400 });
    }

    const result = await revokeUsage(usageId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error('[POST /api/coupons/revoke] Erro:', err);
    return NextResponse.json({ error: 'Erro ao estornar.' }, { status: 500 });
  }
}
