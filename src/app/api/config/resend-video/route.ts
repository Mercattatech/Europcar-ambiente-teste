import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/config/resend-video
 * Rota pública — retorna a URL do vídeo tutorial de reenvio de e-mail.
 * Não requer autenticação (apenas lê o ContentBlock).
 */
export async function GET() {
  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: 'RESEND_EMAIL_VIDEO_URL' },
    });
    return NextResponse.json({ url: block?.value_ptBR || null });
  } catch {
    return NextResponse.json({ url: null });
  }
}
