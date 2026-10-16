import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/checkAdmin';
import { syncCategoriesFromXRS } from '@/lib/europcar/syncCategories';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncCategoriesFromXRS();

    return NextResponse.json({
      success: true,
      message: `${result.totalFound} categorias verificadas na XRS (${result.created} adicionadas, ${result.updated} atualizadas, ${result.onRequestCount} sob consulta).`,
      ...result,
    });
  } catch (error: any) {
    console.error('[api/cars/sync-categories] Erro ao sincronizar categorias:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao sincronizar categorias' },
      { status: 500 }
    );
  }
}
