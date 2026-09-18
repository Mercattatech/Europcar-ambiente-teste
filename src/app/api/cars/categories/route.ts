import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overrides = await (prisma as any).carCategoryOverride.findMany();
    return NextResponse.json(overrides);
  } catch (error: any) {
    console.error('Car categories GET error:', error.message);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { carCode, friendlyName, onRequest } = body;
    if (!carCode?.trim()) return NextResponse.json({ error: 'carCode obrigatório' }, { status: 400 });
    const result = await (prisma as any).carCategoryOverride.upsert({
      where: { carCode: carCode.trim().toUpperCase() },
      update: {
        friendlyName: friendlyName?.trim() || carCode,
        onRequest: onRequest === true,
      },
      create: {
        carCode: carCode.trim().toUpperCase(),
        friendlyName: friendlyName?.trim() || carCode,
        onRequest: onRequest === true,
      },
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const carCode = searchParams.get('carCode');
    if (!carCode) return NextResponse.json({ error: 'carCode obrigatório' }, { status: 400 });
    await (prisma as any).carCategoryOverride.delete({ where: { carCode } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
