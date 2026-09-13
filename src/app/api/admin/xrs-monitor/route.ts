import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

/** GET — retorna configuração atual do monitor XRS */
export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let config = await prisma.xrsMonitorConfig.findFirst();
  if (!config) {
    config = await prisma.xrsMonitorConfig.create({ data: {} });
  }

  return NextResponse.json({
    ...config,
    whatsappNumbers: JSON.parse(config.whatsappNumbers || '[]'),
  });
}

/** PUT — atualiza configuração do monitor XRS */
export async function PUT(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    let config = await prisma.xrsMonitorConfig.findFirst();
    if (!config) {
      config = await prisma.xrsMonitorConfig.create({ data: {} });
    }

    const updateData: any = {};

    if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled);
    if (body.intervalMinutes !== undefined) updateData.intervalMinutes = Math.max(1, Math.min(60, Number(body.intervalMinutes)));
    if (body.messagingIntervalSeconds !== undefined) updateData.messagingIntervalSeconds = Math.max(0, Math.min(120, Number(body.messagingIntervalSeconds)));
    if (body.testStation !== undefined) updateData.testStation = String(body.testStation).trim().toUpperCase();
    if (body.errorMessageTemplate !== undefined) updateData.errorMessageTemplate = String(body.errorMessageTemplate);
    if (body.recoveryMessageTemplate !== undefined) updateData.recoveryMessageTemplate = String(body.recoveryMessageTemplate);

    if (body.whatsappNumbers !== undefined) {
      const nums = Array.isArray(body.whatsappNumbers) ? body.whatsappNumbers : [];
      updateData.whatsappNumbers = JSON.stringify(nums.slice(0, 3).map((n: string) => String(n).replace(/\D/g, '')));
    }

    const updated = await prisma.xrsMonitorConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      whatsappNumbers: JSON.parse(updated.whatsappNumbers || '[]'),
    });
  } catch (error: any) {
    console.error('[xrs-monitor] Erro no PUT:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
