import prisma from '@/lib/prisma';
import { BASE_REJECTION_DICTIONARY } from '@/lib/rejectionDictionaryData';

export interface AIToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Definições oficiais das Ferramentas (Tools) compatíveis com:
 * 1. Model Context Protocol (MCP) da Anthropic (Claude Desktop / Cursor)
 * 2. OpenAI Tool Calling / Function Calling (GPT-4o)
 * 3. Chat Interno do Painel Europcar (/painel/logs e /painel/agente-ia)
 */
export const AI_TOOLS_DEFINITIONS: AIToolDefinition[] = [
  {
    name: 'consultar_recusas_kpis',
    description: 'Consulta os KPIs em tempo real de recusas de pagamento e vendas perdidas (valor total em R$, quantidade de recusas, ticket médio, potencial de recuperação em recusas reversíveis, recusas irreversíveis, antifraude Linx e códigos não mapeados).',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'yesterday', '7d', '30d', 'all'],
          description: 'Período de análise das recusas (padrão: "30d")'
        }
      }
    }
  },
  {
    name: 'consultar_recusas_lista',
    description: 'Lista as transações recusadas recentes com filtros opcionais por bandeira, código, categoria ou termo de busca.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'yesterday', '7d', '30d', 'all'],
          description: 'Período de busca'
        },
        brand: {
          type: 'string',
          description: 'Filtrar por bandeira (ex: Visa, Mastercard, Elo, AmEx)'
        },
        code: {
          type: 'string',
          description: 'Filtrar por código de recusa (ex: 51, 57, FG, GA, GF, GD, GT, GK)'
        },
        category: {
          type: 'string',
          description: 'Filtrar por categoria (ex: INSUFFICIENT_FUNDS, ANTIFRAUD_LINX, CARD_BLOCKED, etc.)'
        },
        search: {
          type: 'string',
          description: 'Termo de busca (nome do cliente, e-mail, order ID ou payment ID)'
        },
        limit: {
          type: 'number',
          description: 'Quantidade máxima de registros a retornar (máximo 50, padrão: 15)'
        }
      }
    }
  },
  {
    name: 'detalhar_recusa',
    description: 'Obtém todos os detalhes operacionais, causa raiz, responsabilidade atribuída, mensagem técnica e diretriz de IA de uma recusa específica usando o Order ID, Payment ID ou Event ID.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'Identificador do pedido (MerchantOrderId) ou PaymentId'
        }
      },
      required: ['orderId']
    }
  },
  {
    name: 'verificar_alertas_seguranca',
    description: 'Verifica em tempo real se existem alertas operacionais críticos ou de alta prioridade (Ataques de Força Bruta GT/GK, Erros de IP da loja na Cielo GF, Bloqueios cadastrais GD ou Retenções Linx GA).',
    inputSchema: {
      type: 'object',
      properties: {
        hours: {
          type: 'number',
          description: 'Janela de horas recentes para verificar alertas (padrão: 48)'
        }
      }
    }
  },
  {
    name: 'gerar_mensagem_recuperacao',
    description: 'Gera uma mensagem pronta, empática e personalizada para enviar ao cliente via WhatsApp ou E-mail com o objetivo de recuperar a venda recusada, respeitando rigorosamente as diretrizes operacionais (nunca acusar fraude, oferecer Pix quando cabível e explicar o motivo de forma amigável).',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MerchantOrderId ou ID da recusa'
        },
        canal: {
          type: 'string',
          enum: ['whatsapp', 'email'],
          description: 'Canal de envio (padrão: "whatsapp")'
        }
      },
      required: ['orderId']
    }
  },
  {
    name: 'consultar_reserva',
    description: 'Consulta os dados completos de uma reserva de locação (número da reserva Europcar XRS, dados do cliente, veículo, estação de retirada e status de pagamento).',
    inputSchema: {
      type: 'object',
      properties: {
        resNumber: {
          type: 'string',
          description: 'Número da reserva Europcar ou termo de busca (nome/CPF/e-mail)'
        }
      },
      required: ['resNumber']
    }
  }
];

function getPeriodDate(period?: string): Date | undefined {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
  if (period === 'yesterday') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
  }
  if (period === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

/**
 * Executor central das ferramentas de IA
 */
export async function executeAITool(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'consultar_recusas_kpis': {
      const since = getPeriodDate(args.period || '30d');
      const where: any = {};
      if (since) where.createdAt = { gte: since };

      const events = await prisma.transactionRejectionLog.findMany({
        where,
        select: {
          amount: true,
          canRetry: true,
          rejectionType: true,
          rejectionCategory: true,
          cardBrand: true,
          returnCodeNormalized: true,
          friendlyExplanation: true
        }
      });

      const totalCount = events.length;
      const totalAmount = events.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const avgTicket = totalCount > 0 ? totalAmount / totalCount : 0;

      const reversible = events.filter(e => e.canRetry === true || e.rejectionType === 'REVERSÍVEL');
      const irreversible = events.filter(e => e.canRetry === false || e.rejectionType === 'IRREVERSÍVEL');
      const linx = events.filter(e => e.rejectionCategory === 'ANTIFRAUD_LINX');
      const unknown = events.filter(e => e.rejectionCategory === 'UNKNOWN_CODE');

      // Top causas por quantidade
      const causeMap = new Map<string, { count: number; amount: number; reason: string }>();
      for (const e of events) {
        const key = `${e.cardBrand || 'Geral'}_${e.returnCodeNormalized || 'SEM_CODIGO'}`;
        const curr = causeMap.get(key) || { count: 0, amount: 0, reason: e.friendlyExplanation || '' };
        curr.count += 1;
        curr.amount += Number(e.amount || 0);
        causeMap.set(key, curr);
      }

      const topCauses = Array.from(causeMap.entries())
        .map(([codeKey, val]) => ({
          code: codeKey,
          motivo: val.reason,
          quantidade: val.count,
          valorPerdidoBRL: val.amount
        }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      return {
        periodoConsultado: args.period || '30d',
        totalRecusas: totalCount,
        valorTotalPerdidoBRL: Number(totalAmount.toFixed(2)),
        ticketMedioBRL: Number(avgTicket.toFixed(2)),
        recusasReversiveis: {
          quantidade: reversible.length,
          potencialRecuperacaoBRL: Number(reversible.reduce((a, c) => a + Number(c.amount || 0), 0).toFixed(2))
        },
        recusasIrreversiveis: {
          quantidade: irreversible.length,
          valorBRL: Number(irreversible.reduce((a, c) => a + Number(c.amount || 0), 0).toFixed(2))
        },
        antifraudeLinx: {
          quantidade: linx.length,
          valorBRL: Number(linx.reduce((a, c) => a + Number(c.amount || 0), 0).toFixed(2))
        },
        naoMapeados: unknown.length,
        top5Causas: topCauses
      };
    }

    case 'consultar_recusas_lista': {
      const since = getPeriodDate(args.period);
      const where: any = {};
      if (since) where.createdAt = { gte: since };
      if (args.brand) where.cardBrand = { contains: args.brand, mode: 'insensitive' };
      if (args.code) where.returnCodeNormalized = args.code.toUpperCase();
      if (args.category) where.rejectionCategory = args.category;
      if (args.search) {
        where.OR = [
          { customerName: { contains: args.search, mode: 'insensitive' } },
          { customerEmail: { contains: args.search, mode: 'insensitive' } },
          { cieloMerchantOrderId: { contains: args.search, mode: 'insensitive' } },
          { cieloPaymentId: { contains: args.search, mode: 'insensitive' } }
        ];
      }

      const limit = Math.min(50, Math.max(1, args.limit || 15));
      const list = await prisma.transactionRejectionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          createdAt: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          cieloMerchantOrderId: true,
          cieloPaymentId: true,
          amount: true,
          provider: true,
          cardBrand: true,
          returnCodeNormalized: true,
          rejectionCategory: true,
          rejectionType: true,
          canRetry: true,
          friendlyExplanation: true,
          recommendedAction: true
        }
      });

      return {
        totalRetornados: list.length,
        recusas: list.map(item => ({
          dataHora: item.createdAt,
          cliente: item.customerName || 'Não informado',
          contato: item.customerEmail || item.customerPhone || '-',
          pedido: item.cieloMerchantOrderId,
          paymentId: item.cieloPaymentId,
          valorBRL: Number(item.amount),
          bandeira: item.cardBrand,
          codigo: item.returnCodeNormalized,
          categoria: item.rejectionCategory,
          reversivel: item.canRetry === true || item.rejectionType === 'REVERSÍVEL',
          motivo: item.friendlyExplanation,
          acaoRecomendada: item.recommendedAction
        }))
      };
    }

    case 'detalhar_recusa': {
      const term = String(args.orderId).trim();
      const recusa = await prisma.transactionRejectionLog.findFirst({
        where: {
          OR: [
            { cieloMerchantOrderId: term },
            { cieloPaymentId: term },
            { eventId: term },
            { id: term }
          ]
        }
      });

      if (!recusa) {
        return {
          encontrado: false,
          mensagem: `Nenhuma recusa encontrada para o identificador "${term}".`
        };
      }

      return {
        encontrado: true,
        id: recusa.id,
        dataHora: recusa.createdAt,
        cliente: {
          nome: recusa.customerName,
          email: recusa.customerEmail,
          telefone: recusa.customerPhone
        },
        pedido: recusa.cieloMerchantOrderId,
        paymentId: recusa.cieloPaymentId,
        valorBRL: Number(recusa.amount),
        metodo: recusa.paymentMethod,
        provedor: recusa.provider,
        bandeira: recusa.cardBrand,
        codigoBruto: recusa.returnCodeRaw,
        codigoNormalizado: recusa.returnCodeNormalized,
        categoria: recusa.rejectionCategory,
        tipo: recusa.rejectionType,
        podeRetentar: recusa.canRetry,
        mensagemTecnicaOriginal: recusa.returnMessage,
        explicacaoAmigavel: recusa.friendlyExplanation,
        atribuicaoResponsabilidade: recusa.responsibility,
        causaRaiz: recusa.rootCause,
        acaoRecomendadaOperacao: recusa.recommendedAction,
        instrucaoComportamentoIA: recusa.aiBehaviorInstruction,
        mensagemAmigavelProntaParaCliente: recusa.customerFriendlyMessage
      };
    }

    case 'verificar_alertas_seguranca': {
      const hours = Math.max(1, args.hours || 48);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const events = await prisma.transactionRejectionLog.findMany({
        where: {
          createdAt: { gte: since },
          returnCodeNormalized: { in: ['GT', 'GK', 'GF', 'GD', 'GA', 'FG'] }
        },
        select: {
          returnCodeNormalized: true,
          amount: true,
          createdAt: true
        }
      });

      const gtCount = events.filter(e => e.returnCodeNormalized === 'GT').length;
      const gkCount = events.filter(e => e.returnCodeNormalized === 'GK').length;
      const gfCount = events.filter(e => e.returnCodeNormalized === 'GF').length;
      const gdCount = events.filter(e => e.returnCodeNormalized === 'GD').length;
      const gaCount = events.filter(e => e.returnCodeNormalized === 'GA').length;
      const fgCount = events.filter(e => e.returnCodeNormalized === 'FG').length;

      const alerts: string[] = [];
      if (gtCount > 0) {
        alerts.push(`🚨 CRÍTICO: ${gtCount} tentativa(s) de Força Bruta detectadas (Código GT) nas últimas ${hours}h! O gateway da Cielo bloqueou o checkout.`);
      }
      if (gkCount > 0) {
        alerts.push(`🚨 CRÍTICO: ${gkCount} bloqueio(s) temporário(s) de segurança ativo(s) pós-ataque (Código GK).`);
      }
      if (gfCount > 0) {
        alerts.push(`⚠️ ALTA PRIORIDADE: ${gfCount} recusa(s) por IP do servidor não liberado na Cielo (Código GF). Verifique o cadastro de IPs no portal Cielo.`);
      }
      if (gdCount > 0) {
        alerts.push(`⚠️ ALTA PRIORIDADE: ${gdCount} recusa(s) por problema de cadastro/filiação do estabelecimento (Código GD).`);
      }
      if (gaCount > 0) {
        alerts.push(`ℹ️ AVISO: ${gaCount} retenção(ões) preventiva(s) pelo Lynx Online (Código GA).`);
      }
      if (fgCount > 0) {
        alerts.push(`ℹ️ INFO: ${fgCount} recusa(s) de cartões AmEx (Código FG).`);
      }

      return {
        statusSeguranca: (gtCount > 0 || gkCount > 0) ? 'CRÍTICO' : (gfCount > 0 || gdCount > 0) ? 'ALTA_PRIORIDADE' : 'OPERACIONAL_NORMAL',
        janelaHoras: hours,
        totalEventosEspeciais: events.length,
        detalhesPorCodigo: { GT: gtCount, GK: gkCount, GF: gfCount, GD: gdCount, GA: gaCount, FG: fgCount },
        alertasAtivos: alerts.length > 0 ? alerts : ['Nenhum incidente crítico ou bloqueio detectado na janela analisada.']
      };
    }

    case 'gerar_mensagem_recuperacao': {
      const term = String(args.orderId).trim();
      const recusa = await prisma.transactionRejectionLog.findFirst({
        where: {
          OR: [
            { cieloMerchantOrderId: term },
            { cieloPaymentId: term },
            { id: term }
          ]
        }
      });

      if (!recusa) {
        return {
          sucesso: false,
          mensagem: `Recusa com ID "${term}" não localizada.`
        };
      }

      const clientePrimeiroNome = recusa.customerName ? recusa.customerName.split(' ')[0] : 'Cliente';
      const valorFormatado = Number(recusa.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const codigo = recusa.returnCodeNormalized || '';

      let textoBase = recusa.customerFriendlyMessage;

      // Se não tiver mensagem customizada no dicionário, cria mensagem empática baseada na reversibilidade
      if (!textoBase) {
        if (recusa.canRetry || recusa.rejectionType === 'REVERSÍVEL') {
          textoBase = 'Identificamos que seu pagamento não foi autorizado pelo banco emissor. Você pode tentar novamente com outro cartão de crédito ou concluir instantaneamente via Pix com aprovação garantida.';
        } else {
          textoBase = 'Houve uma inconsistência no processamento do seu cartão junto ao banco emissor. Para garantir a sua reserva sem cancelamento, sugerimos concluir o pagamento via Pix.';
        }
      }

      const canal = args.canal || 'whatsapp';
      let mensagemFormatada = '';

      if (canal === 'whatsapp') {
        mensagemFormatada = `Olá, ${clientePrimeiroNome}! Tudo bem? Aqui é da Europcar Brasil 🚗\n\n` +
          `Notamos uma tentativa de reserva no valor de ${valorFormatado} (Pedido: ${recusa.cieloMerchantOrderId || 'reserva'}), mas o processamento do cartão não foi concluído pelo banco.\n\n` +
          `ℹ️ *O que aconteceu:* ${textoBase}\n\n` +
          `💡 *Como resolver:* Para garantir o veículo na sua categoria escolhida antes que esgote, você pode tentar com outro cartão ou gerar um Pix agora mesmo.\n\n` +
          `Precisa de ajuda para concluir? Estamos à disposição por aqui!`;
      } else {
        mensagemFormatada = `Prezado(a) ${recusa.customerName || 'Cliente'},\n\n` +
          `Identificamos que a sua tentativa de reserva de locação (Pedido: ${recusa.cieloMerchantOrderId || '-'}) no valor de ${valorFormatado} não pôde ser aprovada pelo emissor do cartão.\n\n` +
          `Motivo informado: ${textoBase}\n\n` +
          `Para não perder a disponibilidade do veículo, solicitamos que tente uma nova forma de pagamento ou utilize o Pix em nosso site.\n\n` +
          `Atenciosamente,\nEquipe Europcar Brasil`;
      }

      return {
        sucesso: true,
        cliente: recusa.customerName,
        telefone: recusa.customerPhone,
        email: recusa.customerEmail,
        pedido: recusa.cieloMerchantOrderId,
        canal,
        mensagemPronta: mensagemFormatada,
        regrasAtendimento: {
          instrucaoIA: recusa.aiBehaviorInstruction || 'Manter tom empático e profissional, sem acusar de fraude ou culpar o cliente.',
          podeRetentar: recusa.canRetry
        }
      };
    }

    case 'consultar_reserva': {
      const term = String(args.resNumber).trim();
      const reserva = await prisma.localReservation.findFirst({
        where: {
          OR: [
            { resNumber: term },
            { merchantOrderId: term },
            { id: term }
          ]
        },
        select: {
          id: true,
          resNumber: true,
          merchantOrderId: true,
          status: true,
          operationalStatus: true,
          customerData: true,
          amountInCents: true,
          createdAt: true
        }
      });

      if (!reserva) {
        return {
          encontrado: false,
          mensagem: `Nenhuma reserva localizada com o termo "${term}".`
        };
      }

      const cust: any = reserva.customerData || {};

      return {
        encontrado: true,
        reserva: {
          numeroReserva: reserva.resNumber || 'Aguardando confirmação XRS',
          orderId: reserva.merchantOrderId,
          statusPagamento: reserva.status,
          statusOperacional: reserva.operationalStatus,
          cliente: `${cust.nome || ''} ${cust.sobrenome || ''}`.trim() || 'Não informado',
          email: cust.email || '-',
          telefone: cust.telefone || '-',
          valorTotalBRL: reserva.amountInCents ? Number((reserva.amountInCents / 100).toFixed(2)) : 0,
          criadoEm: reserva.createdAt
        }
      };
    }

    default:
      throw new Error(`Ferramenta desconhecida: "${toolName}".`);
  }
}
