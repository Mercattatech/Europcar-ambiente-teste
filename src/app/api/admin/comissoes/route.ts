import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { resolvePricingSnapshot } from '@/lib/commissions/pricingSnapshot';

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

      // 3. Process and calculate
      let totalComissao = 0;
      let totalVendas = 0;
      let totalNet = 0;
      let totalMarkup = 0;
      const grouped = {
         'PIX': { vendas: 0, comissao: 0, count: 0 },          // PIX Efetivado (Pago)
         'CREDIT_CARD': { vendas: 0, comissao: 0, count: 0 },  // Cartão de Crédito
         'BALCAO': { vendas: 0, comissao: 0, count: 0 },       // Pagamento no Balcão
         'PIX_PENDING': { vendas: 0, comissao: 0, count: 0 }   // PIX Pendente (Aguardando)
      };

      const resultList = reservations.map(res => {
         const valor = res.amountInCents ? res.amountInCents / 100 : 0;
         const comissao = valor * (rate / 100);
         
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

         // NET capturado da API + markup aplicado (gravados na venda; estimados nas reservas antigas)
         const snap = resolvePricingSnapshot(parsed, res.amountInCents);

         // Totaliza apenas vendas efetivadas (PIX pendente não gera receita confirmada)
         const isEfetivada = tipo !== 'PIX_PENDING';
         if (isEfetivada) {
            totalVendas += valor;
            totalComissao += comissao;
            totalNet += snap?.netBRL || 0;
            totalMarkup += snap?.markupBRL || 0;
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
            // Tarifa escolhida: markup só existe em ETO ("Pagar agora") fora do Brasil
            tarifa: (() => {
               const cid = String(parsed?.booking?.contractID || '');
               if (cid === '56935495') return 'ETO_ZERO';
               if (cid === '56935466' || parsed?.booking?.tariffType === 'ETO') return 'ETO';
               return cid ? 'POA' : null;
            })(),
            estacao: parsed?.booking?.pickupStation ?? null,
            cupom: parsed?.couponData?.code ?? null
         };
      });

      return NextResponse.json({
         rate,
         totalComissao,
         totalVendas,
         totalNet,
         totalMarkup,
         grouped,
         reservations: resultList
      });

   } catch (error: any) {
      console.error('Comissoes API error:', error);
      return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
   }
}
