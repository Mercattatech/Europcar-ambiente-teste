import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DEFAULT_CHECKOUT_SUMMARY_CONFIG, normalizeCheckoutSummaryConfig } from '@/lib/checkout/summaryConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: 'CHECKOUT_SUMMARY_CONFIG' },
    });

    if (!block?.value_ptBR) {
      return NextResponse.json(DEFAULT_CHECKOUT_SUMMARY_CONFIG);
    }

    const parsed = JSON.parse(block.value_ptBR);
    return NextResponse.json(normalizeCheckoutSummaryConfig(parsed));
  } catch (err: any) {
    console.error('[API /api/checkout/summary-config] Erro ao carregar:', err?.message);
    return NextResponse.json(DEFAULT_CHECKOUT_SUMMARY_CONFIG);
  }
}
