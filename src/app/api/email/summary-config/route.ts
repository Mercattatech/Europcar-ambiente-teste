import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DEFAULT_EMAIL_SUMMARY_CONFIG, normalizeEmailSummaryConfig } from '@/lib/email/emailSummaryConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: 'EMAIL_SUMMARY_CONFIG' },
    });

    if (!block?.value_ptBR) {
      return NextResponse.json(DEFAULT_EMAIL_SUMMARY_CONFIG);
    }

    const parsed = JSON.parse(block.value_ptBR);
    return NextResponse.json(normalizeEmailSummaryConfig(parsed));
  } catch (err: any) {
    console.error('[API /api/email/summary-config] Erro ao carregar:', err?.message);
    return NextResponse.json(DEFAULT_EMAIL_SUMMARY_CONFIG);
  }
}
