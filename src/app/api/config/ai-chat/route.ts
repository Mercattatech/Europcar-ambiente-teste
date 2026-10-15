import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/config/ai-chat
 * Rota pública — informa apenas se o assistente IA do site está ativo.
 * Usada pelo AIChatWidget (visitantes não têm acesso a /api/admin/ai-config).
 * Fail-closed: qualquer erro ou ausência de configuração = desligado.
 */
export async function GET() {
  let isActive = false;
  try {
    const config = await prisma.aIAgentConfig.findFirst({ select: { isActive: true } });
    isActive = config?.isActive === true;
  } catch {
    isActive = false;
  }
  return NextResponse.json(
    { isActive },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
