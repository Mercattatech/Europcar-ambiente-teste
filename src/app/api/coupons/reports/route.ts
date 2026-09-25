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
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  let data: any[] = [];
  let csvHeaders = '';

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
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM para Excel

    return new Response(bom + csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio_${type}_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ type, total: data.length, data });
}
