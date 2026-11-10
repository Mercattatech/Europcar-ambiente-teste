import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ensureRejectionTablesAndSeed, registerFailedTransaction } from '@/lib/rejectionService';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = [
  "grupomercatta@gmail.com",
  "matheus@grupomercatta.com.br",
  "matheusconti@gmail.com",
  "matheus@grupomercatta.com"
];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return (dbUser?.role === 'ADMIN' || dbUser?.role === 'VENDEDOR_ADMIN') && dbUser?.status !== 'BLOCKED';
}

function parseDateRange(period?: string, start?: string, end?: string): { gte?: Date; lte?: Date } {
  const now = new Date();
  if (start && end) {
    return {
      gte: new Date(start),
      lte: new Date(end)
    };
  }

  if (period === 'today') {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return { gte: todayStart, lte: now };
  }

  if (period === 'yesterday') {
    const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    return { gte: yStart, lte: yEnd };
  }

  if (period === '7d') {
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { gte: d7, lte: now };
  }

  if (period === '30d') {
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { gte: d30, lte: now };
  }

  return {}; // all
}

export async function GET(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Garante que tabelas e dicionário existam
    await ensureRejectionTablesAndSeed().catch(console.error);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const brand = searchParams.get('brand');
    const provider = searchParams.get('provider');
    const category = searchParams.get('category');
    const rejectionType = searchParams.get('rejectionType');
    const canRetryParam = searchParams.get('canRetry');
    const code = searchParams.get('code');
    const search = searchParams.get('search');
    const isLinxOnly = searchParams.get('isLinxOnly') === 'true';
    const isUnknownOnly = searchParams.get('isUnknownOnly') === 'true';
    const responsibility = searchParams.get('responsibility');
    const specialCode = searchParams.get('specialCode');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
    const view = searchParams.get('view') || 'rejections'; // 'rejections' | 'log_cielo'

    if (view === 'log_cielo') {
      const logsCielo = await prisma.logCielo.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100
      });
      return NextResponse.json({ logCielo: logsCielo });
    }

    const dateFilter = parseDateRange(period, startDateParam || undefined, endDateParam || undefined);

    const where: Prisma.TransactionRejectionLogWhereInput = {};

    if (dateFilter.gte || dateFilter.lte) {
      where.createdAt = {};
      if (dateFilter.gte) where.createdAt.gte = dateFilter.gte;
      if (dateFilter.lte) where.createdAt.lte = dateFilter.lte;
    }

    if (brand && brand !== 'ALL') {
      where.cardBrand = brand;
    }

    if (provider && provider !== 'ALL') {
      where.provider = provider;
    }

    if (category && category !== 'ALL') {
      where.rejectionCategory = category;
    }

    if (rejectionType && rejectionType !== 'ALL') {
      where.rejectionType = rejectionType;
    }

    if (canRetryParam === 'true') {
      where.canRetry = true;
    } else if (canRetryParam === 'false') {
      where.canRetry = false;
    }

    if (code) {
      where.OR = [
        { returnCodeNormalized: { contains: code, mode: 'insensitive' } },
        { returnCodeRaw: { contains: code, mode: 'insensitive' } }
      ];
    }

    if (specialCode) {
      where.returnCodeNormalized = specialCode.toUpperCase();
    }

    if (isLinxOnly) {
      where.rejectionCategory = 'ANTIFRAUD_LINX';
    }

    if (isUnknownOnly) {
      where.OR = [
        { mappingStatus: 'UNKNOWN' },
        { mappingStatus: 'AMBIGUOUS' },
        { rejectionCategory: 'UNKNOWN_CODE' }
      ];
    }

    if (responsibility && responsibility !== 'ALL') {
      where.responsibility = { contains: responsibility, mode: 'insensitive' };
    }

    if (search) {
      const term = search.trim();
      where.OR = [
        { customerName: { contains: term, mode: 'insensitive' } },
        { customerEmail: { contains: term, mode: 'insensitive' } },
        { customerPhone: { contains: term, mode: 'insensitive' } },
        { cieloMerchantOrderId: { contains: term, mode: 'insensitive' } },
        { cieloPaymentId: { contains: term, mode: 'insensitive' } },
        { reservationId: { contains: term, mode: 'insensitive' } },
        { returnCodeRaw: { contains: term, mode: 'insensitive' } },
        { returnCodeNormalized: { contains: term, mode: 'insensitive' } },
        { friendlyExplanation: { contains: term, mode: 'insensitive' } }
      ];
    }

    // Consulta registros filtrados para agregações
    const [allFilteredEvents, totalLogs, paginatedLogs] = await Promise.all([
      prisma.transactionRejectionLog.findMany({
        where,
        select: {
          id: true,
          amount: true,
          cardBrand: true,
          provider: true,
          rejectionCategory: true,
          rejectionType: true,
          canRetry: true,
          returnCodeRaw: true,
          returnCodeNormalized: true,
          returnMessage: true,
          friendlyExplanation: true,
          recommendedAction: true,
          responsibility: true,
          mappingStatus: true,
          createdAt: true
        }
      }),
      prisma.transactionRejectionLog.count({ where }),
      prisma.transactionRejectionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    // 9. Cálculo dos KPIs em tempo real
    const totalCount = allFilteredEvents.length;
    const totalAmount = allFilteredEvents.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const avgTicket = totalCount > 0 ? totalAmount / totalCount : 0;

    const reversibleEvents = allFilteredEvents.filter(e => e.canRetry === true || e.rejectionType === 'REVERSÍVEL');
    const irreversibleEvents = allFilteredEvents.filter(e => e.canRetry === false || e.rejectionType === 'IRREVERSÍVEL');
    const linxEvents = allFilteredEvents.filter(e => e.rejectionCategory === 'ANTIFRAUD_LINX');
    const unknownEvents = allFilteredEvents.filter(e => e.mappingStatus === 'UNKNOWN' || e.mappingStatus === 'AMBIGUOUS' || e.rejectionCategory === 'UNKNOWN_CODE');

    const reversibleAmount = reversibleEvents.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const irreversibleAmount = irreversibleEvents.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const linxAmount = linxEvents.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const unknownAmount = unknownEvents.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    // 10. Agrupamento Top 10 Rejeições (por cardBrand + returnCodeNormalized + friendlyExplanation)
    type GroupKey = string;
    const groupsMap = new Map<GroupKey, {
      cardBrand: string;
      code: string;
      reason: string;
      rejectionCount: number;
      lostAmount: number;
      rejectionType: string | null;
      canRetry: boolean | null;
      recommendedAction: string | null;
      responsibility: string | null;
    }>();

    for (const ev of allFilteredEvents) {
      const b = ev.cardBrand || 'N/A';
      const c = ev.returnCodeNormalized || ev.returnCodeRaw || 'SEM_CODIGO';
      const r = ev.friendlyExplanation || ev.returnMessage || 'Sem descrição';
      const key = `${b}:::${c}:::${r}`;

      const existing = groupsMap.get(key);
      const evAmt = Number(ev.amount || 0);

      if (existing) {
        existing.rejectionCount += 1;
        existing.lostAmount += evAmt;
      } else {
        groupsMap.set(key, {
          cardBrand: b,
          code: c,
          reason: r,
          rejectionCount: 1,
          lostAmount: evAmt,
          rejectionType: ev.rejectionType,
          canRetry: ev.canRetry,
          recommendedAction: ev.recommendedAction,
          responsibility: ev.responsibility
        });
      }
    }

    const allGrouped = Array.from(groupsMap.values()).map(g => ({
      ...g,
      avgTicket: g.rejectionCount > 0 ? g.lostAmount / g.rejectionCount : 0,
      rejectionPct: totalCount > 0 ? Number(((g.rejectionCount / totalCount) * 100).toFixed(2)) : 0
    }));

    // Top 10 ordenado por Quantidade
    const topByCount = [...allGrouped].sort((a, b) => b.rejectionCount - a.rejectionCount).slice(0, 10);

    // Top 10 ordenado por Valor Perdido
    const topByAmount = [...allGrouped].sort((a, b) => b.lostAmount - a.lostAmount).slice(0, 10);

    const topCauseByCount = topByCount[0] || null;
    const topCauseByAmount = topByAmount[0] || null;

    // 11. Gráficos complementares
    // Por Bandeira
    const brandMap = new Map<string, { count: number; amount: number }>();
    for (const ev of allFilteredEvents) {
      const b = ev.cardBrand || 'Outros';
      const curr = brandMap.get(b) || { count: 0, amount: 0 };
      curr.count += 1;
      curr.amount += Number(ev.amount || 0);
      brandMap.set(b, curr);
    }
    const chartByBrand = Array.from(brandMap.entries()).map(([brand, data]) => ({
      brand,
      count: data.count,
      amount: data.amount
    })).sort((a, b) => b.count - a.count);

    // Por Provedor
    const providerMap = new Map<string, { count: number; amount: number }>();
    for (const ev of allFilteredEvents) {
      const p = ev.provider || 'Outros';
      const curr = providerMap.get(p) || { count: 0, amount: 0 };
      curr.count += 1;
      curr.amount += Number(ev.amount || 0);
      providerMap.set(p, curr);
    }
    const chartByProvider = Array.from(providerMap.entries()).map(([provider, data]) => ({
      provider,
      count: data.count,
      amount: data.amount
    })).sort((a, b) => b.count - a.count);

    // Por Categoria
    const categoryMap = new Map<string, { count: number; amount: number }>();
    for (const ev of allFilteredEvents) {
      const cat = ev.rejectionCategory || 'OUTROS';
      const curr = categoryMap.get(cat) || { count: 0, amount: 0 };
      curr.count += 1;
      curr.amount += Number(ev.amount || 0);
      categoryMap.set(cat, curr);
    }
    const chartByCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      amount: data.amount
    })).sort((a, b) => b.count - a.count);

    // Por Responsabilidade
    const respMap = new Map<string, { count: number; amount: number }>();
    for (const ev of allFilteredEvents) {
      const r = ev.responsibility || 'Não atribuída';
      const curr = respMap.get(r) || { count: 0, amount: 0 };
      curr.count += 1;
      curr.amount += Number(ev.amount || 0);
      respMap.set(r, curr);
    }
    const chartByResponsibility = Array.from(respMap.entries()).map(([responsibility, data]) => ({
      responsibility,
      count: data.count,
      amount: data.amount
    })).sort((a, b) => b.count - a.count);

    // Série temporal (dia a dia)
    const timeMap = new Map<string, { date: string; count: number; amount: number }>();
    for (const ev of allFilteredEvents) {
      const dateKey = new Date(ev.createdAt).toISOString().split('T')[0];
      const curr = timeMap.get(dateKey) || { date: dateKey, count: 0, amount: 0 };
      curr.count += 1;
      curr.amount += Number(ev.amount || 0);
      timeMap.set(dateKey, curr);
    }
    const chartTimeSeries = Array.from(timeMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 15. Alertas Operacionais baseados em eventos reais
    const alerts: Array<{
      id: string;
      level: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
      title: string;
      message: string;
      code?: string;
      count: number;
    }> = [];

    const gtCount = allFilteredEvents.filter(e => e.returnCodeNormalized === 'GT').length;
    if (gtCount > 0) {
      alerts.push({
        id: 'alert_gt',
        level: 'CRITICAL',
        title: 'Ataque de Força Bruta Detectado (GT)',
        message: `${gtCount} tentativa(s) bloqueada(s) por detecção de força bruta no checkout. Ação de segurança ativa.`,
        code: 'GT',
        count: gtCount
      });
    }

    const gkCount = allFilteredEvents.filter(e => e.returnCodeNormalized === 'GK').length;
    if (gkCount > 0) {
      alerts.push({
        id: 'alert_gk',
        level: 'CRITICAL',
        title: 'Bloqueio de Segurança Ativo Pós-Ataque (GK)',
        message: `${gkCount} tentativa(s) afetada(s) por bloqueio temporário pós-ataque de força bruta.`,
        code: 'GK',
        count: gkCount
      });
    }

    const gfCount = allFilteredEvents.filter(e => e.returnCodeNormalized === 'GF').length;
    if (gfCount > 0) {
      alerts.push({
        id: 'alert_gf',
        level: 'HIGH',
        title: 'Erro de Configuração/IP da Loja na Cielo (GF)',
        message: `${gfCount} recusa(s) por IP não liberado na Cielo. Requer liberação técnica imediata no painel Cielo.`,
        code: 'GF',
        count: gfCount
      });
    }

    const gdCount = allFilteredEvents.filter(e => e.returnCodeNormalized === 'GD').length;
    if (gdCount > 0) {
      alerts.push({
        id: 'alert_gd',
        level: 'HIGH',
        title: 'Bloqueio de Cadastro/Integração do Estabelecimento (GD)',
        message: `${gdCount} recusa(s) por bloqueio cadastral ou regra de afiliação na Cielo. Contatar gerente de conta adquirente.`,
        code: 'GD',
        count: gdCount
      });
    }

    const gaCount = allFilteredEvents.filter(e => e.returnCodeNormalized === 'GA').length;
    if (gaCount > 0) {
      alerts.push({
        id: 'alert_ga',
        level: 'WARNING',
        title: 'Retenção Preventiva Lynx Online (GA)',
        message: `${gaCount} pedido(s) retido(s) preventivamente pelo Lynx Online. Oferecer Pix ou aguardar análise de risco.`,
        code: 'GA',
        count: gaCount
      });
    }

    const fgCount = allFilteredEvents.filter(e => e.returnCodeNormalized === 'FG').length;
    if (fgCount > 0) {
      alerts.push({
        id: 'alert_fg',
        level: 'INFO',
        title: 'Bloqueio pelo Emissor AmEx (FG)',
        message: `${fgCount} recusa(s) AmEx. Orientar portador a ligar no 0800 728 5090.`,
        code: 'FG',
        count: fgCount
      });
    }

    if (unknownEvents.length > 0) {
      alerts.push({
        id: 'alert_unknown',
        level: 'WARNING',
        title: 'Códigos Desconhecidos Identificados',
        message: `${unknownEvents.length} recusa(s) com códigos ainda não mapeados no dicionário. Analisar payloads brutos para cadastro.`,
        count: unknownEvents.length
      });
    }

    return NextResponse.json({
      kpis: {
        totalAmount,
        totalCount,
        avgTicket,
        reversible: {
          count: reversibleEvents.length,
          pct: totalCount > 0 ? Number(((reversibleEvents.length / totalCount) * 100).toFixed(2)) : 0,
          amount: reversibleAmount
        },
        irreversible: {
          count: irreversibleEvents.length,
          pct: totalCount > 0 ? Number(((irreversibleEvents.length / totalCount) * 100).toFixed(2)) : 0,
          amount: irreversibleAmount
        },
        linxAntifraud: {
          count: linxEvents.length,
          pct: totalCount > 0 ? Number(((linxEvents.length / totalCount) * 100).toFixed(2)) : 0,
          amount: linxAmount
        },
        unknownCodes: {
          count: unknownEvents.length,
          pct: totalCount > 0 ? Number(((unknownEvents.length / totalCount) * 100).toFixed(2)) : 0,
          amount: unknownAmount
        },
        topCauseByCount,
        topCauseByAmount
      },
      top10: {
        byCount: topByCount,
        byAmount: topByAmount
      },
      charts: {
        byBrand: chartByBrand,
        byProvider: chartByProvider,
        byCategory: chartByCategory,
        byResponsibility: chartByResponsibility,
        timeSeries: chartTimeSeries
      },
      alerts,
      pagination: {
        page,
        limit,
        total: totalLogs,
        totalPages: Math.ceil(totalLogs / limit)
      },
      logs: paginatedLogs
    });
  } catch (error: any) {
    console.error('[API /api/admin/logs] Erro ao carregar dados analíticos:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no painel de recusas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'seed';

    if (action === 'seed') {
      const result = await ensureRejectionTablesAndSeed();
      return NextResponse.json({ success: true, seededCount: result.seededCount });
    }

    if (action === 'simulate_test') {
      const code = body.code || '51';
      const brand = body.brand || 'Visa';
      const amount = body.amount || 450.00;
      const orderId = `SIM-${Date.now()}`;

      const saved = await registerFailedTransaction({
        provider: body.provider || 'Cielo',
        brand,
        returnCode: code,
        returnMessage: body.message || 'Transação de teste simulada pelo painel',
        amount,
        paymentMethod: 'CREDIT',
        customerName: 'Cliente Teste Simulação',
        customerEmail: 'cliente.teste@europcar.com.br',
        customerPhone: '+55 11 99999-8888',
        merchantOrderId: orderId
      });

      return NextResponse.json({ success: true, event: saved });
    }

    return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/admin/logs POST] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
