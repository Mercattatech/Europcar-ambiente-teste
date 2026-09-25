import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

// POST /api/referral-event — Registrar evento de referral (fire-and-forget)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { couponCode, event, source, medium, campaign, content, referrer, ipAddress, userAgent, sessionId } = body;

    if (!couponCode || !event) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Buscar cupom e parceiro
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode },
      select: { id: true, partnerId: true },
    });

    await prisma.referralEvent.create({
      data: {
        couponId: coupon?.id || null,
        partnerId: coupon?.partnerId || null,
        sessionId: sessionId || null,
        event,
        source: source || null,
        medium: medium || null,
        campaign: campaign || null,
        content: content || null,
        referrer: referrer || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /api/referral-event] Erro:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
