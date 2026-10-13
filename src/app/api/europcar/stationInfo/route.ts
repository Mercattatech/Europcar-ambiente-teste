import { NextResponse } from 'next/server';
import { getStationInfo, isStationCode } from '@/lib/europcar/stationInfo';
export const dynamic = 'force-dynamic';

/**
 * GET /api/europcar/stationInfo?code=LISX02
 * Versão leve do getStation (sem horários), com cache — usada no tooltip das lojas no painel.
 */
export async function GET(request: Request) {
  const code = (new URL(request.url).searchParams.get('code') || '').trim().toUpperCase();
  if (!isStationCode(code)) {
    return NextResponse.json({ error: 'Código de loja inválido.' }, { status: 400 });
  }
  const station = await getStationInfo(code, 8000);
  if (!station) {
    return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ station }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
