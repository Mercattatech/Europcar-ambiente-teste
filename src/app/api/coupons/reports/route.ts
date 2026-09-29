import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
export const dynamic = 'force-dynamic';

// GET /api/coupons/reports?type=coupons|partners|sales|commissions&format=json|csv&from=&to=
export async function GET(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'coupons';
  const format = searchParams.get('format') || 'json';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const dateFilter: any = {};
  if (from) {
    dateFilter.gte = /^\d{4}-\d{2}-\d{2}$/.test(from)
      ? new Date(`${from}T00:00:00-03:00`)
      : new Date(from);
  }
  if (to) {
    dateFilter.lte = /^\d{4}-\d{2}-\d{2}$/.test(to)
      ? new Date(`${to}T23:59:59.999-03:00`)
      : new Date(to);
  }

  let data: any[] = [];
  let csvHeaders = '';
  let summary: any = {};
  let csvSummaryRows: string[] = [];

  switch (type) {
    case 'coupons': {
      const coupons = await prisma.coupon.findMany({
        where: from || to ? { createdAt: dateFilter } : {},
        include: {
          partner: { select: { name: true } },
          _count: { select: { usages: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      data = coupons.map(c => ({
        Codigo: c.code,
        Nome: c.name,
        Tipo: c.couponType,
        Desconto: c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : c.discountType === 'FIXED_VALUE' ? `R$${c.discountValue}` : '100%',
        Parceiro: c.partner?.name || '',
        Campanha: c.campaign || '',
        Usos: c._count.usages,
        LimiteUsos: c.maxUses || 'Ilimitado',
        Status: c.status,
        CriadoEm: c.createdAt.toISOString(),
      }));
      csvHeaders = 'Codigo,Nome,Tipo,Desconto,Parceiro,Campanha,Usos,LimiteUsos,Status,CriadoEm';
      
      const totalUsages = coupons.reduce((s, c) => s + c._count.usages, 0);
      const activeCoupons = coupons.filter(c => c.status === 'ACTIVE').length;
      summary = {
        totalCoupons: coupons.length,
        activeCoupons,
        totalUsages,
      };
      csvSummaryRows = [
        `\nTOTAL DE CUPONS,,,,,,${totalUsages},,,`,
        `CUPONS ATIVOS: ${activeCoupons} de ${coupons.length},,,,,,,,,`,
      ];
      break;
    }

    case 'partners': {
      const partners = await prisma.partner.findMany({
        where: from || to ? { createdAt: dateFilter } : {},
        include: { _count: { select: { coupons: true, couponUsages: true } } },
        orderBy: { createdAt: 'desc' },
      });
      const enriched = await Promise.all(partners.map(async p => {
        const agg = await prisma.couponUsage.aggregate({
          where: { partnerId: p.id, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
          _sum: { finalValue: true, commissionAmount: true },
        });
        return {
          Nome: p.name,
          Tipo: p.type,
          Email: p.email || '',
          WhatsApp: p.whatsapp || '',
          Cupons: p._count.coupons,
          Vendas: p._count.couponUsages,
          Receita: (agg._sum.finalValue || 0).toFixed(2),
          Comissao: (agg._sum.commissionAmount || 0).toFixed(2),
          Status: p.status,
          CriadoEm: p.createdAt.toISOString(),
        };
      }));
      data = enriched;
      csvHeaders = 'Nome,Tipo,Email,WhatsApp,Cupons,Vendas,Receita,Comissao,Status,CriadoEm';

      const totalVendas = enriched.reduce((s, p) => s + p.Vendas, 0);
      const totalReceita = enriched.reduce((s, p) => s + parseFloat(p.Receita), 0);
      const totalComissao = enriched.reduce((s, p) => s + parseFloat(p.Comissao), 0);
      summary = {
        totalPartners: enriched.length,
        totalVendas,
        totalReceita,
        totalComissao,
      };
      csvSummaryRows = [
        `\nTOTAL DE PARCEIROS (${enriched.length}),,,,,${totalVendas},${totalReceita.toFixed(2)},${totalComissao.toFixed(2)},,`,
      ];
      break;
    }

    case 'sales': {
      const usages = await prisma.couponUsage.findMany({
        where: from || to ? { usedAt: dateFilter } : {},
        include: {
          coupon: { select: { code: true, name: true } },
          partner: { select: { name: true } },
        },
        orderBy: { usedAt: 'desc' },
      });
      data = usages.map(u => ({
        Data: u.usedAt.toISOString(),
        Cupom: u.couponCodeSnapshot,
        Parceiro: u.partner?.name || '',
        Reserva: u.resNumber || '',
        ValorOriginal: u.originalValue.toFixed(2),
        Desconto: u.discountAmount.toFixed(2),
        ValorFinal: u.finalValue.toFixed(2),
        Comissao: (u.commissionAmount || 0).toFixed(2),
        Status: u.status,
      }));
      csvHeaders = 'Data,Cupom,Parceiro,Reserva,ValorOriginal,Desconto,ValorFinal,Comissao,Status';

      const activeUsages = usages.filter(u => u.status !== 'CANCELLED' && u.status !== 'REFUNDED');
      const cancelledUsages = usages.filter(u => u.status === 'CANCELLED' || u.status === 'REFUNDED');

      const sumOriginal = activeUsages.reduce((s, u) => s + (u.originalValue || 0), 0);
      const sumDesconto = activeUsages.reduce((s, u) => s + (u.discountAmount || 0), 0);
      const sumFinal = activeUsages.reduce((s, u) => s + (u.finalValue || 0), 0);
      const sumComissao = activeUsages.reduce((s, u) => s + (u.commissionAmount || 0), 0);

      const sumCancelledOriginal = cancelledUsages.reduce((s, u) => s + (u.originalValue || 0), 0);
      const sumCancelledFinal = cancelledUsages.reduce((s, u) => s + (u.finalValue || 0), 0);

      summary = {
        totalUsages: usages.length,
        activeUsages: activeUsages.length,
        cancelledUsages: cancelledUsages.length,
        sumOriginal,
        sumDesconto,
        sumFinal,
        sumComissao,
        sumCancelledOriginal,
        sumCancelledFinal,
      };

      csvSummaryRows = [
        `\nTOTAL ATIVO (${activeUsages.length} vendas),,,,${sumOriginal.toFixed(2)},${sumDesconto.toFixed(2)},${sumFinal.toFixed(2)},${sumComissao.toFixed(2)},ATIVAS (EXCLUI CANCELADAS)`,
      ];
      if (cancelledUsages.length > 0) {
        csvSummaryRows.push(
          `TOTAL CANCELADO (${cancelledUsages.length} vendas),,,,${sumCancelledOriginal.toFixed(2)},,${sumCancelledFinal.toFixed(2)},,CANCELADAS (NÃO SOMADO)`,
        );
      }
      break;
    }

    case 'commissions': {
      const comms = await prisma.commission.findMany({
        where: from || to ? { createdAt: dateFilter } : {},
        include: {
          partner: { select: { name: true } },
          coupon: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      data = comms.map(c => ({
        Data: c.createdAt.toISOString(),
        Parceiro: c.partner.name,
        Cupom: c.coupon?.code || '',
        Valor: c.amount.toFixed(2),
        Status: c.status,
        Liberacao: c.availableAt?.toISOString() || '',
        Pagamento: c.paidAt?.toISOString() || '',
        Referencia: c.paymentReference || '',
      }));
      csvHeaders = 'Data,Parceiro,Cupom,Valor,Status,Liberacao,Pagamento,Referencia';

      const activeComms = comms.filter(c => c.status !== 'CANCELLED');
      const cancelledComms = comms.filter(c => c.status === 'CANCELLED');
      const paidComms = comms.filter(c => c.status === 'PAID');
      const pendingComms = comms.filter(c => c.status === 'PENDING' || c.status === 'AVAILABLE');

      const sumTotal = activeComms.reduce((s, c) => s + (c.amount || 0), 0);
      const sumPaid = paidComms.reduce((s, c) => s + (c.amount || 0), 0);
      const sumPending = pendingComms.reduce((s, c) => s + (c.amount || 0), 0);
      const sumCancelled = cancelledComms.reduce((s, c) => s + (c.amount || 0), 0);

      summary = {
        totalComms: comms.length,
        activeComms: activeComms.length,
        cancelledComms: cancelledComms.length,
        sumTotal,
        sumPaid,
        sumPending,
        sumCancelled,
      };

      csvSummaryRows = [
        `\nTOTAL ATIVO (${activeComms.length} comissões),,,${sumTotal.toFixed(2)},ATIVAS,,,`,
        `TOTAL PAGO (${paidComms.length}),,,${sumPaid.toFixed(2)},PAGO,,,`,
        `TOTAL PENDENTE/DISPONÍVEL (${pendingComms.length}),,,${sumPending.toFixed(2)},PENDENTE,,,`,
      ];
      if (cancelledComms.length > 0) {
        csvSummaryRows.push(
          `TOTAL CANCELADO (${cancelledComms.length}),,,${sumCancelled.toFixed(2)},CANCELADO,,,`,
        );
      }
      break;
    }

    default:
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  // Retornar CSV
  if (format === 'csv') {
    const csvRows = data.map(row =>
      Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [csvHeaders, ...csvRows, ...csvSummaryRows].join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM para Excel

    return new Response(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio_${type}_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ type, total: data.length, summary, data });
}
