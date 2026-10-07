import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/checkAdmin';
import { executeAITool } from '@/lib/ai/aiTools';

export const dynamic = 'force-dynamic';

/**
 * Orquestrador Local Inteligente
 * Responde às consultas analíticas e operacionais executando as ferramentas da Europcar Brasil
 */
async function localOrchestrator(userPrompt: string): Promise<{ text: string; toolUsed?: string; toolData?: any }> {
  const clean = userPrompt.toLowerCase().trim();

  // 1. RELATÓRIO DE VENDAS & FATURAMENTO
  if (clean.includes('venda') || clean.includes('faturamento') || clean.includes('relatório de vendas') || clean.includes('relatorio de vendas') || clean.includes('quanto faturou') || clean.includes('pix vs')) {
    const period = clean.includes('hoje') ? 'today' : clean.includes('ontem') ? 'yesterday' : clean.includes('semana') || clean.includes('7d') ? '7d' : '30d';
    const data = await executeAITool('relatorio_vendas', { period });

    let text = `📈 **Relatório Consolidado de Vendas (${data.periodo.toUpperCase()}):**\n\n` +
      `• **Faturamento Líquido Total:** R$ ${data.faturamentoLiquidoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `• **Total de Reservas Criadas:** ${data.totalReservasCriadas}\n` +
      `• **Ticket Médio:** R$ ${data.ticketMedioBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `• **Status das Reservas:** ✅ ${data.statusReservas.confirmadas} Confirmadas | ⏳ ${data.statusReservas.emAnaliseOnRequest} On-Request | ❌ ${data.statusReservas.canceladas} Canceladas (${data.statusReservas.taxaCancelamentoPct}%)\n\n` +
      `💳 **Divisão por Forma de Pagamento:**\n` +
      `• 🟢 **PIX:** R$ ${data.faturamentoPorMetodo.PIX.faturamentoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${data.faturamentoPorMetodo.PIX.quantidade} vendas - ${data.faturamentoPorMetodo.PIX.participacaoPct}% do faturamento)\n` +
      `• 🔵 **Cartão de Crédito:** R$ ${data.faturamentoPorMetodo.CartaoCredito.faturamentoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${data.faturamentoPorMetodo.CartaoCredito.quantidade} vendas - ${data.faturamentoPorMetodo.CartaoCredito.participacaoPct}%)\n` +
      `• ⚪ **Balcão / Voucher:** R$ ${(data.faturamentoPorMetodo.Balcao.faturamentoBRL + data.faturamentoPorMetodo.Voucher.faturamentoBRL).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;

    if (data.topEstacoesRetirada && data.topEstacoesRetirada.length > 0) {
      text += `📍 **Top Estações de Retirada:**\n`;
      data.topEstacoesRetirada.forEach((s: any, idx: number) => {
        text += `${idx + 1}. **${s.station}**: ${s.count} reservas\n`;
      });
    }

    return { text, toolUsed: 'relatorio_vendas', toolData: data };
  }

  // 2. CANCELAMENTO DE RESERVA
  if (clean.includes('cancelar') || clean.includes('cancele') || clean.includes('cancela a reserva')) {
    const resNumberMatch = userPrompt.match(/(\d{8,12})/);
    if (resNumberMatch && resNumberMatch[1]) {
      const data = await executeAITool('cancelar_reserva', { resNumber: resNumberMatch[1], motivo: 'Cancelamento via Assistente IA' });
      return {
        text: data.sucesso
          ? `✅ **Reserva ${resNumberMatch[1]} Cancelada com Sucesso!**\n\n• **Status XRS:** ${data.retornoXRS}\n• **Status Banco Local:** CANCELLED\n• **Estorno Cielo:** Disparado\n• **E-mail de Confirmação:** ${data.emailCancelamentoEnviado ? 'Enviado ao cliente' : 'Não enviado'}`
          : `❌ **Falha ao Cancelar:** ${data.mensagem}`,
        toolUsed: 'cancelar_reserva',
        toolData: data
      };
    }
  }

  // 3. REENVIO DE E-MAIL DE CONFIRMAÇÃO
  if (clean.includes('reenviar') || clean.includes('reenvie') || clean.includes('enviar email') || clean.includes('mandar voucher') || clean.includes('reenvio')) {
    const resNumberMatch = userPrompt.match(/(\d{8,12})/);
    const emailMatch = userPrompt.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);

    if (resNumberMatch && resNumberMatch[1]) {
      const data = await executeAITool('reenviar_email_confirmacao', {
        resNumber: resNumberMatch[1],
        novoEmail: emailMatch ? emailMatch[0] : undefined
      });
      return {
        text: data.sucesso
          ? `📨 **${data.mensagem}**`
          : `❌ **Falha no Reenvio:** ${data.mensagem}`,
        toolUsed: 'reenviar_email_confirmacao',
        toolData: data
      };
    }
  }

  // 4. CONSULTA DE RESERVA ESPECÍFICA
  if (clean.includes('reserva') && (clean.includes('consulte') || clean.includes('consultar') || clean.includes('dados') || clean.includes('status') || clean.includes('onde') || clean.includes('quem'))) {
    const resNumberMatch = userPrompt.match(/(\d{8,12})/) || userPrompt.match(/EURO-[\w-]+/);
    if (resNumberMatch && resNumberMatch[0]) {
      const data = await executeAITool('consultar_reserva', { resNumber: resNumberMatch[0] });
      if (data.encontrado) {
        return {
          text: `🚗 **Detalhes da Reserva ${data.numeroReserva}:**\n\n` +
            `• **Cliente:** ${data.cliente?.nome || '-'} (${data.cliente?.email || '-'})\n` +
            `• **Valor Total:** R$ ${data.valorTotalBRL?.toFixed(2)} (${data.metodoPagamento})\n` +
            `• **Status:** ${data.statusPagamento} (Operacional: ${data.statusOperacional})\n` +
            `• **Veículo:** ${data.veiculo?.modelo} (${data.veiculo?.categoriaACRISS})\n` +
            `• **Retirada:** ${data.locacao?.retiradaEstacao} em ${data.locacao?.retiradaData} às ${data.locacao?.retiradaHora}\n` +
            `• **Devolução:** ${data.locacao?.devolucaoEstacao} em ${data.locacao?.devolucaoData} às ${data.locacao?.devolucaoHora}\n` +
            `• **Order ID:** \`${data.orderId}\``,
          toolUsed: 'consultar_reserva',
          toolData: data
        };
      }
    }
  }

  // 5. ALERTAS DE SEGURANÇA OPERACIONAL (GT, GK, GF, GD, GA)
  if (clean.includes('alerta') || clean.includes('segurança') || clean.includes('força bruta') || clean.includes('ip') || clean.includes('ataque')) {
    const data = await executeAITool('verificar_alertas_seguranca', { hours: 48 });
    let text = `🛡️ **Status de Segurança Operacional:** **${data.statusSeguranca}**\n\n`;
    if (data.alertasAtivos && data.alertasAtivos.length > 0) {
      text += data.alertasAtivos.map((a: string) => `• ${a}`).join('\n');
    }
    text += `\n\n*Janela analisada: últimas ${data.janelaHoras} horas.*`;
    return { text, toolUsed: 'verificar_alertas_seguranca', toolData: data };
  }

  // 6. RECUPERAÇÃO DE VENDAS / MENSAGEM WHATSAPP
  if (clean.includes('recuperar') || clean.includes('mensagem') || clean.includes('whatsapp') || clean.includes('recuperação')) {
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

  // 7. CUPONS DE DESCONTO
  if (clean.includes('cupom') || clean.includes('cupons')) {
    const data = await executeAITool('consultar_cupons', {});
    let text = `🏷️ **Cupons Cadastrados no Sistema (${data.totalCupons}):**\n\n`;
    data.cupons.slice(0, 10).forEach((c: any) => {
      text += `• **${c.codigo}**: ${c.valorDesconto} (${c.nome}) - Limite: ${c.limiteUsos}\n`;
    });
    return { text, toolUsed: 'consultar_cupons', toolData: data };
  }

  // 8. LOGS TÉCNICOS DO SISTEMA
  if (clean.includes('log') || clean.includes('cielo log') || clean.includes('xrs log') || clean.includes('erro técnico')) {
    const tipo = clean.includes('xrs') ? 'XRS' : 'CIELO';
    const data = await executeAITool('consultar_logs_sistema', { tipo, limit: 5 });
    let text = `📜 **Últimos Logs Técnicos (${data.tipo}):**\n\n`;
    data.logs.forEach((l: any, i: number) => {
      text += `**${i + 1}. [${new Date(l.dataHora).toLocaleString('pt-BR')}] ${l.endpoint || l.acao}**\n\`\`\`\n${l.response || l.responseXml}\n\`\`\`\n\n`;
    });
    return { text, toolUsed: 'consultar_logs_sistema', toolData: data };
  }

  // 9. CONSULTA DE KPIS DE RECUSAS E PERDAS
  if (clean.includes('kpi') || clean.includes('perda') || clean.includes('recusa') || clean.includes('maiores causas')) {
    const period = clean.includes('hoje') ? 'today' : clean.includes('ontem') ? 'yesterday' : clean.includes('semana') ? '7d' : '30d';
    const data = await executeAITool('consultar_recusas_kpis', { period });

    let text = `📊 **Relatório Analítico de Recusas & Perdas (${period.toUpperCase()}):**\n\n` +
      `• **Valor Total Perdido:** R$ ${data.valorTotalPerdidoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `• **Total de Recusas:** ${data.totalRecusas} tentativas\n` +
      `• **⚡ Potencial de Recuperação (Reversíveis):** R$ ${data.recusasReversiveis.potencialRecuperacaoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${data.recusasReversiveis.quantidade} recusas)\n` +
      `• **🛡️ Linx / Antifraude:** ${data.antifraudeLinx.quantidade} bloqueios (R$ ${data.antifraudeLinx.valorBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n\n`;

    if (data.top5Causas && data.top5Causas.length > 0) {
      text += `🏆 **Top Maiores Causas:**\n`;
      data.top5Causas.forEach((c: any, i: number) => {
        text += `${i + 1}. **${c.code}** - ${c.motivo}: ${c.quantidade}x (R$ ${Number(c.valorPerdidoBRL).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
      });
    }

    return { text, toolUsed: 'consultar_recusas_kpis', toolData: data };
  }

  // Fallback explicativo
  return {
    text: `Olá! Sou o Assistente de Inteligência Operacional da Europcar Brasil 🚗\n\n` +
      `Através das ferramentas MCP conectadas, posso executar ações completas no sistema:\n\n` +
      `• 📊 **Vendas & Relatórios:** *"Relatório de vendas de hoje"*, *"Quanto faturou em Pix este mês?"*\n` +
      `• 🔎 **Consultar Reserva:** *"Consulte a reserva 1152028308"*\n` +
      `• ❌ **Cancelar Reserva:** *"Cancele a reserva 1152028308"*\n` +
      `• 📨 **Reenviar E-mail:** *"Reenvie o email da reserva 1152028308 para email@cliente.com"*\n` +
      `• 💬 **Recuperação de Venda:** *"Gerar mensagem de recuperação para o pedido EURO-123"*\n` +
      `• 🛡️ **Segurança & Recusas:** *"Verifique alertas de segurança"*, *"Quais as maiores perdas de hoje?"*\n` +
      `• 🏷️ **Cupons:** *"Quais cupons estão cadastrados?"*\n\n` +
      `*(Todas essas ferramentas estão ativas e disponíveis nativamente para o Claude Desktop via protocolo MCP)*.`
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
