import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { resolvePricingSnapshot, readEtoMarkupPercent, isEtoContract } from '@/lib/commissions/pricingSnapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      // Datas interpretadas no fuso de Brasília (UTC-3), não no do servidor
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00.000-03:00`);
      if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999-03:00`);

      const resWhere: any = {
         status: { not: 'CANCELLED' } // Canceladas não entram na conta
      };
      if (Object.keys(dateFilter).length > 0) {
         resWhere.createdAt = dateFilter;
      }

      // 1. Get Commission Rate
      const config = await prisma.contentBlock.findUnique({ where: { key: 'COMMISSION_RATE' } });
      const rate = config?.value_ptBR ? parseFloat(config.value_ptBR) : 0;

      // 2. Fetch valid reservations
      const reservations = await prisma.localReservation.findMany({
         where: resWhere,
         orderBy: { createdAt: 'desc' }
      });

      // Margem ETO configurada (usada para derivar o NET de reservas antigas) e usos de cupom por reserva
      const configuredMarkup = await readEtoMarkupPercent();
      const couponByRes = new Map<string, { discountAmount: number }>();
      try {
         const resNumbers = reservations.map(r => r.resNumber).filter((n): n is string => !!n);
         if (resNumbers.length > 0) {
            const usages = await prisma.couponUsage.findMany({
               where: { resNumber: { in: resNumbers }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
               select: { resNumber: true, discountAmount: true },
            });
            for (const u of usages) if (u.resNumber) couponByRes.set(u.resNumber, { discountAmount: u.discountAmount || 0 });
         }
      } catch (e) { /* cupons são informativos: nunca derrubam o relatório */ }

      // 3. Process and calculate
      let totalComissao = 0;
      let totalVendas = 0;
      let totalNet = 0;
      let totalMarkup = 0;
      let totalDesconto = 0;
      let totalMarkupLiquido = 0;
      const grouped = {
         'PIX': { vendas: 0, comissao: 0, count: 0 },          // PIX Efetivado (Pago)
         'CREDIT_CARD': { vendas: 0, comissao: 0, count: 0 },  // Cartão de Crédito
         'BALCAO': { vendas: 0, comissao: 0, count: 0 },       // Pagamento no Balcão
         'PIX_PENDING': { vendas: 0, comissao: 0, count: 0 }   // PIX Pendente (Aguardando)
      };

      const resultList = reservations.map(res => {
         const valor = res.amountInCents ? res.amountInCents / 100 : 0;
         
         let parsed: any = {};
         try {
            parsed = typeof res.customerData === 'string' ? JSON.parse(res.customerData) : res.customerData;
         } catch (e) {}

         const pm = parsed?.paymentMethod || (parsed?.cieloPaymentId && res.status === 'PENDING_PIX' ? 'PIX' : null);

         let tipo = 'BALCAO';
         if (pm === 'PIX' || res.status === 'PENDING_PIX') {
            if (res.status === 'CONFIRMED_PREPAID' || res.status === 'CONFIRMED' || res.status === 'ON_REQUEST') {
               tipo = 'PIX'; // PIX Efetivado!
            } else if (res.status === 'PENDING_PIX') {
               tipo = 'PIX_PENDING'; // Aguardando pagamento PIX
            } else {
               tipo = 'PIX';
            }
         } else if (pm === 'CREDIT' || (res.status === 'CONFIRMED_PREPAID' && pm !== 'PIX')) {
            tipo = 'CREDIT_CARD';
         } else if (pm === 'BALCAO' || res.status === 'CONFIRMED_NON_PREPAID') {
            tipo = 'BALCAO';
         } else {
            tipo = res.status === 'CONFIRMED_PREPAID' ? 'CREDIT_CARD' : 'BALCAO';
         }

         // NET real (gravado na venda ou reconsultado no XRS). Sem estimativas: ETO sem NET real = null.
         const snap = resolvePricingSnapshot(parsed, res.amountInCents, { configuredMarkupPercent: configuredMarkup });
         const semNetReal = !snap && isEtoContract(parsed?.booking?.contractID);

         // Desconto do cupom: uso registrado (CouponUsage) ou valor fixo "R$ x de desconto" no rótulo
         const couponLabel: string | null = parsed?.couponData?.discountLabel ?? null;
         let descontoCupom: number | null = null;
         if (res.resNumber && couponByRes.has(res.resNumber)) {
            descontoCupom = couponByRes.get(res.resNumber)!.discountAmount;
         } else if (couponLabel) {
            const m = couponLabel.match(/R\$\s*([\d.]+,\d{2})/);
            if (m) descontoCupom = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
         }
         // Markup líquido: o markup registrado na venda (NET × margem) é nominal; se houve cupom, desconta-se.
         // No reconsultado (XRS_BACKFILL) o markup já é valor cobrado − NET real, então o cupom já está descontado.
         const markupLiquidoBRL = snap
            ? (snap.source === 'XRS_QUOTE' && descontoCupom ? Math.max(0, snap.markupBRL - descontoCupom) : snap.markupBRL)
            : null;

         // ── Regra de comissão ─────────────────────────────────────────────
         // Markup = NET (API) × % da página /painel/margem (gravado no pricingSnapshot da venda).
         // Comissão = rate% (COMMISSION_RATE, ex.: 7,5) do markup LÍQUIDO (markup − cupom),
         // somente em vendas pagas online: Cartão de Crédito e PIX efetivado.
         // Balcão e PIX pendente não geram comissão.
         const geraComissao = tipo === 'CREDIT_CARD' || tipo === 'PIX';
         const comissao = geraComissao ? Math.max(0, markupLiquidoBRL || 0) * (rate / 100) : 0;

         // Totaliza apenas vendas efetivadas (PIX pendente não gera receita confirmada)
         const isEfetivada = tipo !== 'PIX_PENDING';
         if (isEfetivada) {
            totalVendas += valor;
            totalComissao += comissao;
            totalNet += snap?.netBRL || 0;
            totalMarkup += snap?.markupBRL || 0;
            totalDesconto += descontoCupom || 0;
            totalMarkupLiquido += markupLiquidoBRL || 0;
         }
         
         if (tipo === 'PIX') {
            grouped.PIX.vendas += valor;
            grouped.PIX.comissao += comissao;
            grouped.PIX.count += 1;
         } else if (tipo === 'CREDIT_CARD') {
            grouped.CREDIT_CARD.vendas += valor;
            grouped.CREDIT_CARD.comissao += comissao;
            grouped.CREDIT_CARD.count += 1;
         } else if (tipo === 'PIX_PENDING') {
            grouped.PIX_PENDING.vendas += valor;
            grouped.PIX_PENDING.comissao += comissao;
            grouped.PIX_PENDING.count += 1;
         } else {
            grouped.BALCAO.vendas += valor;
            grouped.BALCAO.comissao += comissao;
            grouped.BALCAO.count += 1;
         }

         return {
            ...res,
            valorCalculado: valor,
            comissaoCalculada: comissao,
            tipoPagamento: tipo,
            isEfetivada,
            netBRL: snap?.netBRL ?? null,
            netLocal: snap?.netLocal ?? null,
            netCurrency: snap?.netCurrency ?? null,
            markupPercent: snap?.markupPercent ?? null,
            markupBRL: snap?.markupBRL ?? null,
            netSource: snap?.source ?? null,
            semNetReal,
            netErro: semNetReal ? (parsed?.pricingBackfill?.error ?? null) : null,
            // Tarifa escolhida: markup só existe em ETO ("Pagar agora") fora do Brasil
            tarifa: (() => {
               const cid = String(parsed?.booking?.contractID || '');
               if (cid === '56935495') return 'ETO_ZERO';
               if (cid === '56935466' || parsed?.booking?.tariffType === 'ETO') return 'ETO';
               return cid ? 'POA' : null;
            })(),
            estacao: parsed?.booking?.pickupStation ?? null,
            cupom: parsed?.couponData?.code ?? null,
            cupomLabel: couponLabel,
            descontoCupom,
            markupLiquidoBRL
         };
      });

      return NextResponse.json({
         rate,
         totalComissao,
         totalVendas,
         totalNet,
         totalMarkup,
         totalDesconto,
         totalMarkupLiquido,
         grouped,
         reservations: resultList
      });

   } catch (error: any) {
      console.error('Comissoes API error:', error);
      return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
   }
}
