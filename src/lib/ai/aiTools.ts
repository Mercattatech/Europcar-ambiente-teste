import prisma from '@/lib/prisma';
import { callXRS, getStations, getStation } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { consultarDisponibilidade } from '@/lib/europcar/availability';
import { cancelXRSReservation, voidCieloPaymentForLocalReservation } from '@/lib/europcar/cancelService';
import { sendTransactionalEmail } from '@/lib/emailService';
import { sendBookingConfirmation } from '@/lib/email/sendBookingConfirmation';
import { buildEmailCurrencyVars } from '@/lib/receiptLocales';

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
 * Catálogo Oficial de Ferramentas de IA & MCP da Europcar Brasil
 * Permite que o Claude Desktop, ChatGPT ou o Assistente Interno
 * operem 100% do sistema: Vendas, Reservas, Cancelamentos, Modificações, E-mails e Recusas.
 */
export const AI_TOOLS_DEFINITIONS: AIToolDefinition[] = [
  // ── 1. GESTÃO DE RESERVAS ──
  {
    name: 'consultar_reserva',
    description: 'Consulta os dados detalhados de uma reserva na Europcar pelo número da reserva (resNumber), OrderId ou busca por dados do cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        resNumber: {
          type: 'string',
          description: 'Número da reserva Europcar (ex: 1152028308) ou OrderId (ex: EURO-1729000000)'
        }
      },
      required: ['resNumber']
    }
  },
  {
    name: 'cancelar_reserva',
    description: 'Cancela uma reserva no sistema oficial Europcar XRS, atualiza o status no banco de dados local para CANCELLED, estorna a transação Cielo caso capturada e envia o e-mail de confirmação de cancelamento ao cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        resNumber: {
          type: 'string',
          description: 'Número da reserva Europcar a cancelar'
        },
        motivo: {
          type: 'string',
          description: 'Motivo do cancelamento (opcional)'
        }
      },
      required: ['resNumber']
    }
  },
  {
    name: 'alterar_reserva',
    description: 'Modifica datas, horários, estações ou categoria de uma reserva existente diretamente no sistema oficial Europcar XRS e atualiza o banco local.',
    inputSchema: {
      type: 'object',
      properties: {
        resNumber: {
          type: 'string',
          description: 'Número da reserva Europcar a ser alterada'
        },
        pickupDate: {
          type: 'string',
          description: 'Nova data de retirada no formato YYYYMMDD (ex: 20261015)'
        },
        pickupTime: {
          type: 'string',
          description: 'Novo horário de retirada no formato HHMM (ex: 1000 ou 1430)'
        },
        pickupStationID: {
          type: 'string',
          description: 'Código da nova estação de retirada (ex: OPOST01, LISST01)'
        },
        returnDate: {
          type: 'string',
          description: 'Nova data de devolução no formato YYYYMMDD (ex: 20261022)'
        },
        returnTime: {
          type: 'string',
          description: 'Novo horário de devolução no formato HHMM (ex: 1000 ou 1800)'
        },
        returnStationID: {
          type: 'string',
          description: 'Código da nova estação de devolução (opcional)'
        },
        carCategory: {
          type: 'string',
          description: 'Novo código de categoria de veículo ACRISS (ex: EDMR, CDMR, FDAR)'
        }
      },
      required: ['resNumber']
    }
  },
  {
    name: 'reenviar_email_confirmacao',
    description: 'Reenvia o e-mail oficial de confirmação de reserva (voucher completo com proteções, valores e regras de retirada) para o cliente ou para um novo endereço informado.',
    inputSchema: {
      type: 'object',
      properties: {
        resNumber: {
          type: 'string',
          description: 'Número da reserva Europcar'
        },
        novoEmail: {
          type: 'string',
          description: 'Endereço de e-mail alternativo para envio (se omitido, usa o e-mail cadastrado na reserva)'
        }
      },
      required: ['resNumber']
    }
  },
  {
    name: 'listar_reservas',
    description: 'Lista as reservas criadas em um intervalo de datas (horário de Brasília), com filtros opcionais por status e forma de pagamento. Retorna por reserva: número, OrderId, data/hora de criação, estação de retirada, data de checkout (retirada), forma de pagamento, status e valor em R$, além do total somado.',
    inputSchema: {
      type: 'object',
      properties: {
        dataInicial: {
          type: 'string',
          description: 'Data inicial de criação da reserva, inclusiva (YYYY-MM-DD ou DD/MM/YYYY). Ex: 2026-09-25'
        },
        dataFinal: {
          type: 'string',
          description: 'Data final de criação da reserva, inclusiva (YYYY-MM-DD ou DD/MM/YYYY). Se omitida, usa a mesma da dataInicial (um único dia).'
        },
        status: {
          type: 'string',
          description: 'Filtrar por status (ex: CONFIRMED, CANCELLED, ON_REQUEST, PENDING, PAID). Busca parcial: "CONFIRMED" inclui CONFIRMED_PREPAID. Padrão: ALL'
        },
        paymentMethod: {
          type: 'string',
          enum: ['ALL', 'PIX', 'CREDIT', 'BALCAO', 'VOUCHER'],
          description: 'Filtrar por forma de pagamento (padrão: ALL)'
        },
        limit: {
          type: 'number',
          description: 'Quantidade máxima de reservas a retornar (máximo 500, padrão: 200)'
        }
      },
      required: ['dataInicial']
    }
  },

  // ── 2. RELATÓRIOS & ANALYTICS DE VENDAS ──
  {
    name: 'relatorio_vendas',
    description: 'Gera relatório analítico consolidado de vendas e faturamento da Europcar Brasil: faturamento total em R$, quantidade de reservas, divisão por método de pagamento (PIX, Cartão de Crédito, Balcão, Voucher), ticket médio, taxas de conversão e top estações.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'yesterday', '7d', '30d', 'all'],
          description: 'Período do relatório (padrão: "30d"). Ignorado quando dataInicial é informada.'
        },
        dataInicial: {
          type: 'string',
          description: 'Data inicial personalizada, inclusiva (YYYY-MM-DD ou DD/MM/YYYY, horário de Brasília). Substitui "period".'
        },
        dataFinal: {
          type: 'string',
          description: 'Data final personalizada, inclusiva (YYYY-MM-DD ou DD/MM/YYYY). Se omitida, usa a mesma da dataInicial.'
        },
        paymentMethod: {
          type: 'string',
          enum: ['ALL', 'PIX', 'CREDIT', 'BALCAO', 'VOUCHER'],
          description: 'Filtrar por método de pagamento específico (opcional)'
        },
        status: {
          type: 'string',
          enum: ['ALL', 'CONFIRMED', 'CANCELLED', 'ON_REQUEST'],
          description: 'Filtrar por status da reserva (opcional)'
        }
      }
    }
  },

  // ── 3. OBSERVABILIDADE DE RECUSAS & RECUPERAÇÃO ──
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
          description: 'Filtrar por categoria (ex: INSUFFICIENT_FUNDS, ANTIFRAUD_LINX, CARD_BLOCKED)'
        },
        search: {
          type: 'string',
          description: 'Termo de busca (nome, e-mail, order ID ou payment ID)'
        },
        limit: {
          type: 'number',
          description: 'Limite de registros a retornar (máximo 50, padrão: 15)'
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
    description: 'Gera uma mensagem pronta, empática e personalizada para enviar ao cliente via WhatsApp ou E-mail com o objetivo de recuperar a venda recusada, respeitando rigorosamente as diretrizes operacionais.',
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

  // ── 4. GESTÃO DE CUPONS & PARCEIROS ──
  {
    name: 'consultar_cupons',
    description: 'Consulta os cupons de desconto cadastrados no sistema, regras comerciais, percentuais e limites de uso.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Código do cupom ou nome de campanha para busca'
        },
        onlyActive: {
          type: 'boolean',
          description: 'Filtrar apenas cupons válidos/ativos'
        }
      }
    }
  },
  {
    name: 'criar_cupom',
    description: 'Cadastra um novo cupom de desconto promocional no sistema.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Código em caixa alta (ex: EUROPCAR10, PARCEIRO20)'
        },
        name: {
          type: 'string',
          description: 'Nome da campanha ou descrição'
        },
        discountType: {
          type: 'string',
          enum: ['PERCENTAGE', 'FIXED_VALUE'],
          description: 'Tipo de desconto (PERCENTAGE = porcentagem, FIXED_VALUE = valor fixo em R$)'
        },
        discountValue: {
          type: 'number',
          description: 'Valor do desconto (ex: 10 para 10% ou 50 para R$ 50)'
        },
        maxDiscount: {
          type: 'number',
          description: 'Teto máximo de desconto em Reais (opcional)'
        },
        maxUses: {
          type: 'number',
          description: 'Quantidade máxima de utilizações totais (opcional)'
        }
      },
      required: ['code', 'discountValue']
    }
  },

  // ── 5. DIAGNÓSTICO & LOGS TÉCNICOS ──
  {
    name: 'consultar_logs_sistema',
    description: 'Consulta os logs de auditoria e integração bruta (LogCielo e LogXRS) para diagnóstico de erros técnicos, payloads e respostas de endpoints externos.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['CIELO', 'XRS'],
          description: 'Tipo de log a consultar (padrão: "CIELO")'
        },
        search: {
          type: 'string',
          description: 'Termo para busca dentro do payload ou resposta (ex: número da reserva, OrderId, e-mail)'
        },
        dataInicial: {
          type: 'string',
          description: 'Data inicial dos logs, inclusiva (YYYY-MM-DD ou DD/MM/YYYY, horário de Brasília). Opcional.'
        },
        dataFinal: {
          type: 'string',
          description: 'Data final dos logs, inclusiva (YYYY-MM-DD ou DD/MM/YYYY). Se omitida, usa a mesma da dataInicial.'
        },
        limit: {
          type: 'number',
          description: 'Quantidade máxima de logs a retornar (padrão: 10, máximo 25)'
        }
      }
    }
  },

  // ── 6. DISPONIBILIDADE & LOJAS ──
  {
    name: 'consultar_disponibilidade',
    description: 'Consulta em tempo real (XRS) quais categorias de carro (códigos ACRISS, ex.: CDMR) estão disponíveis, sob requisição ou ausentes para uma loja de retirada/devolução e período, com preço por dia e total (na moeda local e em R$). Em lojas fora do Brasil retorna também as tarifas "Pagar agora" (ETO) já com o markup do painel. Use listar_estacoes para descobrir o código da loja de um país/cidade.',
    inputSchema: {
      type: 'object',
      properties: {
        lojaRetirada: { type: 'string', description: 'Código da loja de retirada (ex.: LIST01 = Lisboa Aeroporto). Veja listar_estacoes.' },
        lojaDevolucao: { type: 'string', description: 'Código da loja de devolução. Se omitido, usa a mesma da retirada.' },
        dataRetirada: { type: 'string', description: 'Data de retirada (YYYY-MM-DD ou DD/MM/YYYY).' },
        horaRetirada: { type: 'string', description: 'Hora de retirada (HH:MM). Padrão 10:00.' },
        dataDevolucao: { type: 'string', description: 'Data de devolução (YYYY-MM-DD ou DD/MM/YYYY).' },
        horaDevolucao: { type: 'string', description: 'Hora de devolução (HH:MM). Padrão: mesma da retirada.' },
        categorias: { type: 'array', items: { type: 'string' }, description: 'Lista de categorias ACRISS (ex.: ["CDMR","EDAR"]). Se omitida, consulta todas as categorias que a loja opera.' },
        idadeCondutor: { type: 'number', description: 'Idade do condutor (influencia preço e elegibilidade). Opcional.' },
        paisResidencia: { type: 'string', description: 'País de residência do condutor, ISO-2 (padrão: BR).' },
        incluirPrecoLiquido: { type: 'boolean', description: 'Uso interno: inclui o preço NET (sem markup) nas tarifas ETO.' }
      },
      required: ['lojaRetirada', 'dataRetirada', 'dataDevolucao']
    }
  },
  {
    name: 'listar_estacoes',
    description: 'Lista as lojas (estações) Europcar de um país (código ISO-2, ex.: PT, IT, BR) com código, nome e cidade, ou detalha uma loja (endereço, telefone, e-mail, antecedência mínima). Use para obter o código da loja antes de consultar_disponibilidade.',
    inputSchema: {
      type: 'object',
      properties: {
        pais: { type: 'string', description: 'País em ISO-2 (ex.: PT, IT, FR, US, BR).' },
        busca: { type: 'string', description: 'Filtro por nome/cidade/código (ex.: "lisboa", "airport").' },
        codigo: { type: 'string', description: 'Código de uma loja para ver os detalhes (ignora pais/busca).' },
        limit: { type: 'number', description: 'Máximo de lojas na lista (padrão 50, máximo 200).' }
      }
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
 * Converte "YYYY-MM-DD" ou "DD/MM/YYYY" em {y, m, d}.
 */
function parseDateInput(value: string): { y: number; m: number; d: number } | null {
  const v = String(value || '').trim();
  let match = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return { y: Number(match[3]), m: Number(match[2]), d: Number(match[1]) };
  return null;
}

/**
 * Intervalo [gte, lt) em UTC correspondente aos dias inteiros no horário de Brasília (UTC-3).
 * Retorna undefined quando dataInicial não é informada.
 */
function getDateRange(dataInicial?: string, dataFinal?: string): { gte: Date; lt: Date } | undefined {
  if (!dataInicial) return undefined;
  const ini = parseDateInput(dataInicial);
  if (!ini) throw new Error(`dataInicial inválida: "${dataInicial}". Use YYYY-MM-DD ou DD/MM/YYYY.`);
  const fim = dataFinal ? parseDateInput(dataFinal) : ini;
  if (!fim) throw new Error(`dataFinal inválida: "${dataFinal}". Use YYYY-MM-DD ou DD/MM/YYYY.`);

  const gte = new Date(Date.UTC(ini.y, ini.m - 1, ini.d, 3, 0, 0));
  const lt = new Date(Date.UTC(fim.y, fim.m - 1, fim.d + 1, 3, 0, 0));
  if (lt <= gte) throw new Error('dataFinal deve ser igual ou posterior à dataInicial.');
  return { gte, lt };
}

function formatDateTimeBR(date: Date): string {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Executor central das ferramentas de IA & MCP
 */
export async function executeAITool(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    // ═══════════════════════════════════════════════════════════
    // 1. GESTÃO DE RESERVAS
    // ═══════════════════════════════════════════════════════════
    case 'consultar_reserva': {
      const term = String(args.resNumber || '').trim();
      if (!term) throw new Error('Identificador da reserva é obrigatório.');

      const reserva = await prisma.localReservation.findFirst({
        where: {
          OR: [
            { resNumber: term },
            { merchantOrderId: term },
            { id: term }
          ]
        }
      });

      if (!reserva) {
        return {
          encontrado: false,
          mensagem: `Nenhuma reserva localizada com o termo "${term}".`
        };
      }

      const cd: any = typeof reserva.customerData === 'string'
        ? JSON.parse(reserva.customerData)
        : reserva.customerData || {};
      const booking = cd.booking || {};
      const car = booking.car || {};

      // Busca logs XRS associados a esta reserva no banco
      const logsXrs = await prisma.logXRS.findMany({
        where: {
          OR: [
            { xmlResponse: { contains: term } },
            { xmlRequest: { contains: term } },
            ...(reserva.merchantOrderId ? [
              { xmlRequest: { contains: reserva.merchantOrderId } },
              { xmlResponse: { contains: reserva.merchantOrderId } }
            ] : [])
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 3
      });

      return {
        encontrado: true,
        numeroReserva: reserva.resNumber || 'Pendente XRS',
        orderId: reserva.merchantOrderId,
        statusPagamento: reserva.status,
        statusOperacional: reserva.operationalStatus,
        valorTotalBRL: reserva.amountInCents ? Number((reserva.amountInCents / 100).toFixed(2)) : 0,
        metodoPagamento: cd.paymentMethod || 'UNKNOWN',
        cliente: {
          nome: `${cd.nome || ''} ${cd.sobrenome || ''}`.trim() || 'Não informado',
          email: cd.email || '-',
          telefone: cd.telefone || '-',
          cpf: cd.cpf || '-'
        },
        veiculo: {
          modelo: car.carCategoryName || car.carCategorySample || car.name || '-',
          categoriaACRISS: car.carCategoryCode || car.acrissCode || '-'
        },
        locacao: {
          retiradaEstacao: booking.pickupStation || '-',
          retiradaData: booking.pickupDate || '-',
          retiradaHora: booking.pickupTime || '-',
          devolucaoEstacao: booking.returnStation || booking.pickupStation || '-',
          devolucaoData: booking.returnDate || '-',
          devolucaoHora: booking.returnTime || '-'
        },
        valoresCalculoXrs: {
          totalRateEstimate: car.totalRateEstimate || null,
          totalRateEstimateInBookingCurrency: car.totalRateEstimateInBookingCurrency || null,
          totalRateInBookingCurrency: car.totalRateInBookingCurrency || null,
          exchangeRate: car.exchangeRate || null,
          bookingCurrency: car.bookingCurrencyOfTotalRateEstimate || car.currency || null,
          payerSplit: cd.payerSplit || booking.payerSplit || null,
        },
        xmlsXRS: logsXrs.map(l => ({
          acao: l.action,
          dataHora: l.createdAt,
          requestXml: l.xmlRequest,
          responseXml: l.xmlResponse
        })),
        criadoEm: reserva.createdAt
      };
    }

    case 'listar_reservas': {
      const range = getDateRange(args.dataInicial, args.dataFinal);
      if (!range) throw new Error('dataInicial é obrigatória (YYYY-MM-DD ou DD/MM/YYYY).');

      const where: any = { createdAt: range };
      const statusFilter = String(args.status || 'ALL').trim().toUpperCase();
      if (statusFilter && statusFilter !== 'ALL') {
        where.status = { contains: statusFilter, mode: 'insensitive' };
      }

      const reservations = await prisma.localReservation.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        select: {
          resNumber: true,
          merchantOrderId: true,
          status: true,
          operationalStatus: true,
          amountInCents: true,
          customerData: true,
          createdAt: true
        }
      });

      const methodFilter = String(args.paymentMethod || 'ALL').toUpperCase();
      const limit = Math.min(500, Math.max(1, Number(args.limit) || 200));

      const rows = reservations
        .map(res => {
          const cd: any = typeof res.customerData === 'string'
            ? JSON.parse(res.customerData)
            : res.customerData || {};
          const booking = cd.booking || {};
          return {
            numeroReserva: res.resNumber || 'Pendente XRS',
            orderId: res.merchantOrderId,
            criadoEm: formatDateTimeBR(res.createdAt),
            estacaoRetirada: booking.pickupStation || '-',
            dataCheckout: booking.pickupDate || '-',
            horaCheckout: booking.pickupTime || '-',
            formaPagamento: String(cd.paymentMethod || 'UNKNOWN').toUpperCase(),
            status: res.status,
            statusOperacional: res.operationalStatus,
            valorBRL: Number(((res.amountInCents || 0) / 100).toFixed(2))
          };
        })
        .filter(r => methodFilter === 'ALL' || r.formaPagamento.includes(methodFilter));

      const valorTotalBRL = rows.reduce((acc, r) => acc + r.valorBRL, 0);

      return {
        intervalo: {
          dataInicial: args.dataInicial,
          dataFinal: args.dataFinal || args.dataInicial,
          fusoHorario: 'America/Sao_Paulo'
        },
        filtros: { status: statusFilter, formaPagamento: methodFilter },
        totalEncontradas: rows.length,
        totalRetornadas: Math.min(rows.length, limit),
        valorTotalBRL: Number(valorTotalBRL.toFixed(2)),
        reservas: rows.slice(0, limit)
      };
    }

    case 'cancelar_reserva': {
      const resNumber = String(args.resNumber || '').trim();
      if (!resNumber) throw new Error('resNumber é obrigatório para cancelamento.');

      const localRes = await prisma.localReservation.findFirst({
        where: {
          OR: [
            { resNumber },
            { merchantOrderId: resNumber }
          ]
        }
      });

      if (!localRes) {
        return {
          sucesso: false,
          mensagem: `Reserva "${resNumber}" não encontrada no banco de dados local.`
        };
      }

      const finalResNumber = localRes.resNumber || resNumber;

      // 1. Chama cancelamento no XRS Europcar
      const { hasError, errorMsg } = await cancelXRSReservation(finalResNumber);

      // 2. Atualiza status no banco local para CANCELLED
      await prisma.localReservation.update({
        where: { id: localRes.id },
        data: { status: 'CANCELLED', operationalStatus: 'CC' }
      });

      // 3. Estorna transação Cielo se capturada
      voidCieloPaymentForLocalReservation(localRes.id).catch(console.error);

      // 4. Envia e-mail de cancelamento para o cliente
      let emailEnviado = false;
      const cd: any = typeof localRes.customerData === 'string'
        ? JSON.parse(localRes.customerData)
        : localRes.customerData || {};

      if (cd?.email) {
        try {
          const amtBRL = (localRes.amountInCents || 0) / 100;
          await sendTransactionalEmail(cd.email, 'CANCELAMENTO', {
            NOME: cd.nome || 'Cliente',
            NUMERO_RESERVA: finalResNumber,
            VALOR_TOTAL: `R$ ${amtBRL.toFixed(2).replace('.', ',')}`,
            MOTIVO: args.motivo || 'Solicitado via central de atendimento'
          });
          emailEnviado = true;
        } catch (e) {
          console.error('[cancelar_reserva] Erro ao enviar e-mail:', e);
        }
      }

      return {
        sucesso: true,
        mensagem: `Reserva ${finalResNumber} cancelada com sucesso!`,
        retornoXRS: hasError ? `Aviso XRS: ${errorMsg} (status local atualizado para CANCELLED)` : 'Cancelada com sucesso no XRS',
        statusLocal: 'CANCELLED',
        estornoCieloIniciado: true,
        emailCancelamentoEnviado: emailEnviado
      };
    }

    case 'alterar_reserva': {
      const resNumber = String(args.resNumber || '').trim();
      if (!resNumber) throw new Error('resNumber é obrigatório para modificação.');

      const localRes = await prisma.localReservation.findFirst({
        where: {
          OR: [
            { resNumber },
            { merchantOrderId: resNumber }
          ]
        }
      });

      if (!localRes) {
        return { sucesso: false, mensagem: `Reserva "${resNumber}" não localizada.` };
      }

      const checkoutParts: string[] = [];
      if (args.pickupStationID) checkoutParts.push(`stationID="${escapeXml(args.pickupStationID)}"`);
      if (args.pickupDate) checkoutParts.push(`date="${escapeXml(args.pickupDate)}"`);
      if (args.pickupTime) checkoutParts.push(`time="${escapeXml(args.pickupTime)}"`);
      const checkoutBlock = checkoutParts.length > 0 ? `\n        <checkout ${checkoutParts.join(' ')}/>` : '';

      const checkinParts: string[] = [];
      if (args.returnStationID) checkinParts.push(`stationID="${escapeXml(args.returnStationID)}"`);
      if (args.returnDate) checkinParts.push(`date="${escapeXml(args.returnDate)}"`);
      if (args.returnTime) checkinParts.push(`time="${escapeXml(args.returnTime)}"`);
      const checkinBlock = checkinParts.length > 0 ? `\n        <checkin ${checkinParts.join(' ')}/>` : '';

      const carCategoryAttr = args.carCategory ? ` carCategory="${escapeXml(args.carCategory)}"` : '';

      const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="modifyReservation">
    <serviceParameters>
      <reservation resNumber="${escapeXml(localRes.resNumber || resNumber)}"${carCategoryAttr}>${checkoutBlock}${checkinBlock}
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;

      const xrsConfig = {
        callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
        password: process.env.XRS_PASSWORD || 'DEMO',
        action: 'modifyReservation',
        sourceFile: 'aiTools.ts'
      };

      const xrsResponse = await callXRS(xmlRequest, xrsConfig);

      const returnCode = xrsResponse?.message?.serviceResponse?.$?.returnCode || xrsResponse?.message?.serviceResponse?.returnCode;
      const isOK = returnCode === 'OK' || returnCode === '0';

      if (!isOK) {
        const errNode = xrsResponse?.message?.serviceResponse?.errors || xrsResponse?.serviceResponse?.errors;
        const errArr = errNode ? (Array.isArray(errNode.error) ? errNode.error : [errNode.error]).filter(Boolean) : [];
        const errText = errArr.map((e: any) => e.description || e.text || e.$?.errorText || '').join(' | ') || 'XRS não aprovou a modificação';
        return {
          sucesso: false,
          mensagem: `Falha na alteração junto à Europcar: ${errText}`
        };
      }

      // Atualiza no banco local os campos alterados
      const cd: any = typeof localRes.customerData === 'string'
        ? JSON.parse(localRes.customerData)
        : localRes.customerData || {};
      const booking = cd.booking || {};

      if (args.pickupDate) booking.pickupDate = args.pickupDate;
      if (args.pickupTime) booking.pickupTime = args.pickupTime;
      if (args.pickupStationID) booking.pickupStation = args.pickupStationID;
      if (args.returnDate) booking.returnDate = args.returnDate;
      if (args.returnTime) booking.returnTime = args.returnTime;
      if (args.returnStationID) booking.returnStation = args.returnStationID;
      if (args.carCategory) {
        if (!booking.car) booking.car = {};
        booking.car.carCategoryCode = args.carCategory;
      }
      cd.booking = booking;

      await prisma.localReservation.update({
        where: { id: localRes.id },
        data: { customerData: cd }
      });

      return {
        sucesso: true,
        mensagem: `Reserva ${localRes.resNumber} alterada com sucesso no XRS e no banco de dados!`,
        dadosAtualizados: {
          retirada: `${args.pickupDate || booking.pickupDate} às ${args.pickupTime || booking.pickupTime} (${args.pickupStationID || booking.pickupStation})`,
          devolucao: `${args.returnDate || booking.returnDate} às ${args.returnTime || booking.returnTime} (${args.returnStationID || booking.returnStation})`,
          categoria: args.carCategory || booking.car?.carCategoryCode
        }
      };
    }

    case 'reenviar_email_confirmacao': {
      const resNumber = String(args.resNumber || '').trim();
      const localRes = await prisma.localReservation.findFirst({
        where: {
          OR: [
            { resNumber },
            { merchantOrderId: resNumber }
          ]
        }
      });

      if (!localRes) {
        return { sucesso: false, mensagem: `Reserva "${resNumber}" não localizada.` };
      }

      const cd: any = typeof localRes.customerData === 'string'
        ? JSON.parse(localRes.customerData)
        : localRes.customerData || {};
      const booking = cd.booking || {};
      const car = booking.car || {};
      const targetEmail = args.novoEmail || cd.email;

      if (!targetEmail) {
        return { sucesso: false, mensagem: 'Nenhum e-mail de destino encontrado para esta reserva.' };
      }

      const amountBRL = (localRes.amountInCents || 0) / 100;
      const _resExchangeRate = parseFloat(car?.exchangeRate || '0');
      const _currVars = buildEmailCurrencyVars(
        amountBRL,
        booking?.pickupStation || null,
        _resExchangeRate,
        car?.currency || null
      );

      const emailVars: Record<string, string> = {
        NOME: cd.nome || 'Cliente',
        SOBRENOME: cd.sobrenome || '',
        EMAIL: targetEmail,
        TELEFONE: cd.telefone || '',
        CPF: cd.cpf || '',
        NUMERO_RESERVA: localRes.resNumber || resNumber,
        VALOR_TOTAL: _currVars.VALOR_TOTAL,
        VALOR_LOCAL: _currVars.VALOR_LOCAL,
        VALOR_BRL: _currVars.VALOR_BRL,
        MOEDA: _currVars.MOEDA,
        FORMA_PAGAMENTO: cd.paymentMethod || 'CREDIT',
        CARRO: car.carCategoryName || car.carCategorySample || car.name || 'Veículo Europcar',
        CATEGORIA_CARRO: car.carCategoryCode || car.acrissCode || '',
        DATA_RETIRADA: booking.pickupDate || '',
        HORARIO_RETIRADA: booking.pickupTime || '',
        LOCAL_RETIRADA: booking.pickupStation || '',
        DATA_DEVOLUCAO: booking.returnDate || '',
        HORARIO_DEVOLUCAO: booking.returnTime || '',
        LOCAL_DEVOLUCAO: booking.returnStation || booking.pickupStation || '',
        LISTA_PROTECOES: 'Proteções contratadas conforme voucher',
        LISTA_EXTRAS: 'Acessórios inclusos conforme voucher'
      };

      const result = await sendTransactionalEmail(targetEmail, 'RESERVA_SUCESSO', emailVars);

      if (!result.success && result.error === 'Template não encontrado') {
        await sendBookingConfirmation({
          toEmail: targetEmail,
          customerName: `${cd.nome || ''} ${cd.sobrenome || ''}`.trim() || 'Cliente',
          resNumber: localRes.resNumber || resNumber,
          carName: car.carCategoryName || car.carCategorySample || 'Veículo Europcar',
          pickupStation: booking.pickupStation || '',
          returnStation: booking.returnStation || booking.pickupStation || '',
          pickupDate: booking.pickupDate || '',
          returnDate: booking.returnDate || '',
          paymentMethod: cd.paymentMethod || 'CREDIT',
          totalBRL: amountBRL
        });
      }

      return {
        sucesso: true,
        mensagem: `E-mail de confirmação da reserva ${localRes.resNumber || resNumber} reenviado com sucesso para "${targetEmail}"!`,
        destinatario: targetEmail
      };
    }

    // ═══════════════════════════════════════════════════════════
    // 2. RELATÓRIOS & ANALYTICS DE VENDAS
    // ═══════════════════════════════════════════════════════════
    case 'relatorio_vendas': {
      const customRange = getDateRange(args.dataInicial, args.dataFinal);
      const since = customRange ? undefined : getPeriodDate(args.period || '30d');
      const where: any = {};
      if (customRange) where.createdAt = customRange;
      else if (since) where.createdAt = { gte: since };

      if (args.status && args.status !== 'ALL') {
        where.status = args.status;
      }

      const allReservations = await prisma.localReservation.findMany({
        where,
        select: {
          id: true,
          resNumber: true,
          status: true,
          operationalStatus: true,
          amountInCents: true,
          customerData: true,
          createdAt: true
        }
      });

      const totalCount = allReservations.length;
      let totalAmountBRL = 0;
      let confirmedCount = 0;
      let cancelledCount = 0;
      let onRequestCount = 0;

      const methodsMap = {
        PIX: { count: 0, amountBRL: 0 },
        CREDIT: { count: 0, amountBRL: 0 },
        BALCAO: { count: 0, amountBRL: 0 },
        VOUCHER: { count: 0, amountBRL: 0 },
        OUTROS: { count: 0, amountBRL: 0 }
      };

      const stationMap = new Map<string, number>();

      for (const res of allReservations) {
        const amt = (res.amountInCents || 0) / 100;
        const isCancelled = res.status === 'CANCELLED' || res.operationalStatus === 'CC';
        const isConfirmed = res.status.includes('CONFIRMED') || res.operationalStatus === 'S';
        const isOnReq = res.status === 'ON_REQUEST' || res.operationalStatus === 'R';

        if (isCancelled) {
          cancelledCount++;
        } else {
          totalAmountBRL += amt;
          if (isConfirmed) confirmedCount++;
          if (isOnReq) onRequestCount++;
        }

        const cd: any = typeof res.customerData === 'string'
          ? JSON.parse(res.customerData)
          : res.customerData || {};
        const method = (cd.paymentMethod || 'OUTROS').toUpperCase();

        if (method.includes('PIX')) {
          methodsMap.PIX.count++;
          if (!isCancelled) methodsMap.PIX.amountBRL += amt;
        } else if (method.includes('CREDIT')) {
          methodsMap.CREDIT.count++;
          if (!isCancelled) methodsMap.CREDIT.amountBRL += amt;
        } else if (method.includes('BALCAO')) {
          methodsMap.BALCAO.count++;
          if (!isCancelled) methodsMap.BALCAO.amountBRL += amt;
        } else if (method.includes('VOUCHER')) {
          methodsMap.VOUCHER.count++;
          if (!isCancelled) methodsMap.VOUCHER.amountBRL += amt;
        } else {
          methodsMap.OUTROS.count++;
          if (!isCancelled) methodsMap.OUTROS.amountBRL += amt;
        }

        const st = cd.booking?.pickupStation || 'Outra';
        stationMap.set(st, (stationMap.get(st) || 0) + 1);
      }

      const topStations = Array.from(stationMap.entries())
        .map(([station, count]) => ({ station, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const activeCount = confirmedCount + onRequestCount;
      const avgTicket = activeCount > 0 ? totalAmountBRL / activeCount : 0;

      return {
        periodo: customRange
          ? `${args.dataInicial} a ${args.dataFinal || args.dataInicial}`
          : (args.period || '30d'),
        totalReservasCriadas: totalCount,
        faturamentoLiquidoBRL: Number(totalAmountBRL.toFixed(2)),
        ticketMedioBRL: Number(avgTicket.toFixed(2)),
        statusReservas: {
          confirmadas: confirmedCount,
          emAnaliseOnRequest: onRequestCount,
          canceladas: cancelledCount,
          taxaCancelamentoPct: totalCount > 0 ? Number(((cancelledCount / totalCount) * 100).toFixed(2)) : 0
        },
        faturamentoPorMetodo: {
          PIX: {
            quantidade: methodsMap.PIX.count,
            faturamentoBRL: Number(methodsMap.PIX.amountBRL.toFixed(2)),
            participacaoPct: totalAmountBRL > 0 ? Number(((methodsMap.PIX.amountBRL / totalAmountBRL) * 100).toFixed(2)) : 0
          },
          CartaoCredito: {
            quantidade: methodsMap.CREDIT.count,
            faturamentoBRL: Number(methodsMap.CREDIT.amountBRL.toFixed(2)),
            participacaoPct: totalAmountBRL > 0 ? Number(((methodsMap.CREDIT.amountBRL / totalAmountBRL) * 100).toFixed(2)) : 0
          },
          Balcao: {
            quantidade: methodsMap.BALCAO.count,
            faturamentoBRL: Number(methodsMap.BALCAO.amountBRL.toFixed(2))
          },
          Voucher: {
            quantidade: methodsMap.VOUCHER.count,
            faturamentoBRL: Number(methodsMap.VOUCHER.amountBRL.toFixed(2))
          }
        },
        topEstacoesRetirada: topStations
      };
    }

    // ═══════════════════════════════════════════════════════════
    // 3. RECUSAS & RECUPERAÇÃO DE VENDAS
    // ═══════════════════════════════════════════════════════════
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
          valorPerdidoBRL: Number(val.amount.toFixed(2))
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
        alerts.push(`🚨 CRÍTICO: ${gtCount} tentativa(s) de Força Bruta detectadas (Código GT) nas últimas ${hours}h! Bloqueio de gateway ativado.`);
      }
      if (gkCount > 0) {
        alerts.push(`🚨 CRÍTICO: ${gkCount} bloqueio(s) temporário(s) de segurança ativo(s) pós-ataque (Código GK).`);
      }
      if (gfCount > 0) {
        alerts.push(`⚠️ ALTA PRIORIDADE: ${gfCount} recusa(s) por IP do servidor não liberado na Cielo (Código GF). Requer liberação no portal Cielo.`);
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

      let textoBase = recusa.customerFriendlyMessage;
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

    // ═══════════════════════════════════════════════════════════
    // 4. GESTÃO DE CUPONS
    // ═══════════════════════════════════════════════════════════
    case 'consultar_cupons': {
      const where: any = {};
      if (args.search) {
        where.OR = [
          { code: { contains: args.search, mode: 'insensitive' } },
          { name: { contains: args.search, mode: 'insensitive' } }
        ];
      }

      const cupons = await prisma.coupon.findMany({
        where,
        orderBy: { code: 'asc' },
        take: 30
      });

      return {
        totalCupons: cupons.length,
        cupons: cupons.map(c => ({
          codigo: c.code,
          nome: c.name,
          tipo: c.discountType,
          valorDesconto: c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `R$ ${c.discountValue}`,
          tetoMaximo: c.maxDiscount ? `R$ ${c.maxDiscount}` : 'Sem teto',
          limiteUsos: c.maxUses || 'Ilimitado',
          expiraEm: c.expiresAt ? c.expiresAt.toISOString().split('T')[0] : 'Sem expiração'
        }))
      };
    }

    case 'criar_cupom': {
      const code = String(args.code || '').trim().toUpperCase();
      if (!code) throw new Error('Código do cupom é obrigatório.');

      const existing = await prisma.coupon.findUnique({ where: { code } });
      if (existing) {
        return { sucesso: false, mensagem: `O cupom com código "${code}" já existe no sistema.` };
      }

      const newCoupon = await prisma.coupon.create({
        data: {
          code,
          name: args.name || `Cupom Promocional ${code}`,
          discountType: args.discountType || 'PERCENTAGE',
          discountValue: Number(args.discountValue) || 10,
          maxDiscount: args.maxDiscount ? Number(args.maxDiscount) : null,
          maxUses: args.maxUses ? Number(args.maxUses) : null,
          couponType: 'PROMOTIONAL',
          stackable: false
        }
      });

      return {
        sucesso: true,
        mensagem: `Cupom ${newCoupon.code} criado com sucesso!`,
        cupom: {
          codigo: newCoupon.code,
          tipo: newCoupon.discountType,
          valor: newCoupon.discountValue,
          maxDiscount: newCoupon.maxDiscount
        }
      };
    }

    // ═══════════════════════════════════════════════════════════
    // 5. DIAGNÓSTICO & LOGS TÉCNICOS
    // ═══════════════════════════════════════════════════════════
    case 'consultar_logs_sistema': {
      const tipo = args.tipo || 'CIELO';
      const limit = Math.min(25, Math.max(1, args.limit || 10));
      const termo = String(args.search || args.termo || args.query || args.resNumber || '').trim();
      const logRange = getDateRange(args.dataInicial, args.dataFinal);

      if (tipo === 'XRS') {
        const whereClause: any = termo ? {
          OR: [
            { xmlRequest: { contains: termo } },
            { xmlResponse: { contains: termo } }
          ]
        } : {};
        if (logRange) whereClause.createdAt = logRange;

        const xrsLogs = await prisma.logXRS.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit
        });
        return {
          tipo: 'XRS',
          termoFiltrado: termo || null,
          total: xrsLogs.length,
          logs: xrsLogs.map(l => ({
            id: l.id,
            dataHora: l.createdAt,
            acao: l.action,
            requestXml: termo ? l.xmlRequest : (l.xmlRequest || '').slice(0, 300) + '...',
            responseXml: termo ? l.xmlResponse : (l.xmlResponse || '').slice(0, 300) + '...'
          }))
        };
      }

      const whereCielo: any = termo ? {
        OR: [
          { payload: { contains: termo } },
          { response: { contains: termo } }
        ]
      } : {};
      if (logRange) whereCielo.createdAt = logRange;

      const cieloLogs = await prisma.logCielo.findMany({
        where: whereCielo,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return {
        tipo: 'CIELO',
        termoFiltrado: termo || null,
        total: cieloLogs.length,
        logs: cieloLogs.map(l => ({
          id: l.id,
          dataHora: l.createdAt,
          endpoint: l.endpoint,
          payload: termo ? l.payload : l.payload.slice(0, 300) + '...',
          response: termo ? l.response : l.response.slice(0, 300) + '...'
        }))
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. DISPONIBILIDADE & LOJAS
    // ═══════════════════════════════════════════════════════════════
    case 'consultar_disponibilidade': {
      const categorias = Array.isArray(args.categorias)
        ? args.categorias
        : typeof args.categorias === 'string'
          ? args.categorias.split(/[\s,;]+/)
          : [];
      return consultarDisponibilidade({
        lojaRetirada: args.lojaRetirada || args.pickupStation,
        lojaDevolucao: args.lojaDevolucao || args.returnStation,
        dataRetirada: args.dataRetirada || args.pickupDate,
        horaRetirada: args.horaRetirada || args.pickupTime,
        dataDevolucao: args.dataDevolucao || args.returnDate,
        horaDevolucao: args.horaDevolucao || args.returnTime,
        categorias,
        idadeCondutor: args.idadeCondutor != null ? Number(args.idadeCondutor) : undefined,
        paisResidencia: args.paisResidencia,
        incluirPrecoLiquido: args.incluirPrecoLiquido === true,
      });
    }

    case 'listar_estacoes': {
      const codigo = String(args.codigo || '').trim().toUpperCase();
      if (codigo) {
        const st = await getStation(codigo);
        if (!st) throw new Error(`Loja "${codigo}" não encontrada.`);
        return {
          codigo: st.stationCode,
          nome: st.stationName,
          cidade: st.cityName,
          pais: st.countryCode,
          endereco: [st.address1, st.address2, st.postalCode].filter(Boolean).join(', '),
          telefone: st.phoneWithInternationalDialling || st.phoneNumber,
          email: st.email,
          antecedênciaMinima: st.leadTime,
          entrega: st.delivery,
          coleta: st.collection,
        };
      }

      const pais = String(args.pais || '').trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(pais)) throw new Error('Informe o país em ISO-2 (ex.: PT, IT, BR) ou o código de uma loja.');
      const busca = String(args.busca || '').trim().toLowerCase();
      const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));

      const todas = await getStations(pais);
      const filtradas = busca
        ? todas.filter((s) => `${s.stationCode} ${s.stationName} ${s.cityName || ''}`.toLowerCase().includes(busca))
        : todas;
      return {
        pais,
        total: filtradas.length,
        exibindo: Math.min(limit, filtradas.length),
        lojas: filtradas.slice(0, limit).map((s) => ({ codigo: s.stationCode, nome: s.stationName, cidade: s.cityName })),
      };
    }

    default:
      throw new Error(`Ferramenta desconhecida: "${toolName}".`);
  }
}
