import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { executeAITool, AI_TOOLS_DEFINITIONS } from '@/lib/ai/aiTools';

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
  return true;
}

/**
 * Orquestrador Local Inteligente
 * Responde às consultas analíticas e operacionais executando as ferramentas mesmo sem chaves OpenAI/Anthropic externas
 */
async function localOrchestrator(userPrompt: string): Promise<{ text: string; toolUsed?: string; toolData?: any }> {
  const clean = userPrompt.toLowerCase().trim();

  // 1. Alertas de segurança / força bruta / IP
  if (clean.includes('alerta') || clean.includes('segurança') || clean.includes('força bruta') || clean.includes('ip') || clean.includes('ataque')) {
    const data = await executeAITool('verificar_alertas_seguranca', { hours: 48 });
    let text = `🛡️ **Status de Segurança Operacional:** **${data.statusSeguranca}**\n\n`;
    if (data.alertasAtivos && data.alertasAtivos.length > 0) {
      text += data.alertasAtivos.map((a: string) => `• ${a}`).join('\n');
    }
    text += `\n\n*Janela analisada: últimas ${data.janelaHoras} horas.*`;
    return { text, toolUsed: 'verificar_alertas_seguranca', toolData: data };
  }

  // 2. Recuperação de venda / mensagem cliente
  if (clean.includes('recuperar') || clean.includes('mensagem') || clean.includes('whatsapp') || clean.includes('texto para o cliente')) {
    // Tenta extrair ID do pedido do texto
    const orderMatch = userPrompt.match(/([A-Za-z0-9_-]{8,})/);
    const orderId = orderMatch ? orderMatch[1] : '';

    if (orderId) {
      const data = await executeAITool('gerar_mensagem_recuperacao', { orderId, canal: 'whatsapp' });
      if (data.sucesso) {
        return {
          text: `💬 **Mensagem de Recuperação Gerada para WhatsApp:**\n\n\`\`\`\n${data.mensagemPronta}\n\`\`\`\n\n📌 *Diretriz IA:* ${data.regrasAtendimento?.instrucaoIA}`,
          toolUsed: 'gerar_mensagem_recuperacao',
          toolData: data
        };
      }
    }
  }

  // 3. Detalhes de um pedido específico
  const orderMatch = userPrompt.match(/pedido\s+([A-Za-z0-9_-]+)/i) || userPrompt.match(/order\s+([A-Za-z0-9_-]+)/i);
  if (orderMatch && orderMatch[1]) {
    const data = await executeAITool('detalhar_recusa', { orderId: orderMatch[1] });
    if (data.encontrado) {
      return {
        text: `📑 **Detalhes da Recusa para o Pedido ${data.pedido}:**\n\n` +
          `• **Cliente:** ${data.cliente?.nome || 'N/A'} (${data.cliente?.email || '-'})\n` +
          `• **Valor:** R$ ${data.valorBRL?.toFixed(2)}\n` +
          `• **Bandeira / Código:** ${data.bandeira} - Código **${data.codigoNormalizado}**\n` +
          `• **Motivo Amigável:** ${data.explicacaoAmigavel}\n` +
          `• **Responsabilidade:** ${data.atribuicaoResponsabilidade || 'Não especificada'}\n` +
          `• **Pode Retentar?** ${data.podeRetentar ? 'SIM (Reversível)' : 'NÃO (Irreversível)'}\n` +
          `• **Ação Recomendada:** ${data.acaoRecomendadaOperacao || 'Consultar adquirente'}`,
        toolUsed: 'detalhar_recusa',
        toolData: data
      };
    }
  }

  // 4. Consulta de KPIs / Valores perdidos / Maiores causas
  if (clean.includes('kpi') || clean.includes('perda') || clean.includes('quanto') || clean.includes('recusa') || clean.includes('hoje') || clean.includes('ontem') || clean.includes('semana') || clean.includes('top') || clean.includes('causa')) {
    const period = clean.includes('hoje') ? 'today' : clean.includes('ontem') ? 'yesterday' : clean.includes('semana') ? '7d' : '30d';
    const data = await executeAITool('consultar_recusas_kpis', { period });

    let text = `📊 **Relatório Analítico de Recusas (${period.toUpperCase()}):**\n\n` +
      `• **Valor Total Perdido:** R$ ${data.valorTotalPerdidoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `• **Total de Recusas:** ${data.totalRecusas} tentativas\n` +
      `• **Ticket Médio:** R$ ${data.ticketMedioBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `• **⚡ Potencial de Recuperação (Reversíveis):** R$ ${data.recusasReversiveis.potencialRecuperacaoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${data.recusasReversiveis.quantidade} recusas)\n` +
      `• **🛡️ Bloqueios Linx/Antifraude:** ${data.antifraudeLinx.quantidade} (R$ ${data.antifraudeLinx.valorBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n\n`;

    if (data.top5Causas && data.top5Causas.length > 0) {
      text += `🏆 **Top Maiores Causas de Recusa:**\n`;
      data.top5Causas.forEach((c: any, i: number) => {
        text += `${i + 1}. **${c.code}** - ${c.motivo}: ${c.quantidade} ocorrência(s) (R$ ${Number(c.valorPerdidoBRL).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
      });
    }

    return { text, toolUsed: 'consultar_recusas_kpis', toolData: data };
  }

  // 5. Fallback com ajuda sobre comandos disponíveis
  return {
    text: `Olá! Sou o Assistente de Inteligência Operacional da Europcar Brasil 🚗\n\n` +
      `Posso ajudar com consultas analíticas e operacionais em tempo real. Experimente perguntar:\n\n` +
      `• *"Qual o valor total de perdas e recusas de hoje?"*\n` +
      `• *"Quais as maiores causas de recusa dos últimos 7 dias?"*\n` +
      `• *"Existe algum alerta de segurança crítico ou erro de IP ativo?"*\n` +
      `• *"Como recuperar o pedido ORDER-123?"*\n` +
      `• *"Detalhe a recusa do pedido ORDER-123"*\n\n` +
      `*(Este assistente também está disponível via protocolo MCP para conexão direta com o Claude Desktop ou Cursor)*.`
  };
}

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const message = body.message || '';

    if (!message.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    // Executa pelo Orquestrador Inteligente
    const response = await localOrchestrator(message);

    return NextResponse.json({
      success: true,
      reply: response.text,
      toolUsed: response.toolUsed || null,
      toolData: response.toolData || null
    });
  } catch (error: any) {
    console.error('[AI Chat Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
