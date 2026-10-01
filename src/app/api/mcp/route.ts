import { NextResponse } from 'next/server';
import { AI_TOOLS_DEFINITIONS, executeAITool } from '@/lib/ai/aiTools';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export const dynamic = 'force-dynamic';

const DEFAULT_MCP_KEY = process.env.MCP_API_KEY || 'europcar_mcp_secure_key_2026';

/**
 * Validação de segurança para o MCP
 */
async function authenticateRequest(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization') || '';
  const xMcpKey = request.headers.get('x-mcp-key') || '';
  const { searchParams } = new URL(request.url);
  const queryKey = searchParams.get('key') || '';

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // 1. Chave de API dedicada ao MCP
  if (token === DEFAULT_MCP_KEY || xMcpKey === DEFAULT_MCP_KEY || queryKey === DEFAULT_MCP_KEY) {
    return true;
  }

  // 2. Se for acesso autenticado via cookie de sessão do painel
  const session = await getServerSession(authOptions).catch(() => null);
  if (session?.user?.email) {
    return true;
  }

  return false;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mcp-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * GET /api/mcp
 * Endpoint de descoberta e documentação de configuração para o Claude Desktop / MCP Clients
 * Suporta tanto JSON simples quanto SSE (Server-Sent Events) padrão MCP
 */
export async function GET(request: Request) {
  const isAuth = await authenticateRequest(request);
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const fullUrl = `${protocol}://${host}/api/mcp`;
  const acceptHeader = request.headers.get('accept') || '';

  // Se o Claude conectar via SSE (Server-Sent Events padrão MCP)
  if (acceptHeader.includes('text/event-stream')) {
    const encoder = new TextEncoder();
    const endpointUrl = `${fullUrl}?key=${DEFAULT_MCP_KEY}`;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        ...corsHeaders,
      },
    });
  }

  return NextResponse.json({
    status: 'ONLINE',
    server: 'Europcar Brasil MCP Server',
    protocolVersion: '2024-11-05',
    authenticated: isAuth,
    toolsAvailable: AI_TOOLS_DEFINITIONS.length,
    tools: AI_TOOLS_DEFINITIONS.map(t => ({
      name: t.name,
      description: t.description
    })),
    claudeDesktopConfigExample: {
      mcpServers: {
        "europcar-brasil": {
          url: fullUrl,
          headers: {
            "Authorization": `Bearer ${DEFAULT_MCP_KEY}`
          }
        }
      }
    }
  }, {
    headers: corsHeaders
  });
}

/**
 * POST /api/mcp
 * Manipulador central de protocolo JSON-RPC 2.0 do Model Context Protocol
 */
export async function POST(request: Request) {
  if (!(await authenticateRequest(request))) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Não autorizado. Forneça o Bearer Token no cabeçalho Authorization ou query param ?key=...' },
        id: null
      },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const { jsonrpc, id, method, params } = body;

    // 1. Handshake Initialize
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'europcar-brasil-mcp',
            version: '1.0.0'
          }
        }
      }, { headers: corsHeaders });
    }

    // 2. Notificação Initialized
    if (method === 'notifications/initialized') {
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    // 3. Ping
    if (method === 'ping') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: {} }, { headers: corsHeaders });
    }

    // 4. Listar Ferramentas (tools/list)
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: AI_TOOLS_DEFINITIONS
        }
      }, { headers: corsHeaders });
    }

    // 5. Executar Ferramenta (tools/call)
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      try {
        const executionResult = await executeAITool(toolName, toolArgs);

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof executionResult === 'string' ? executionResult : JSON.stringify(executionResult, null, 2)
              }
            ]
          }
        }, { headers: corsHeaders });
      } catch (toolError: any) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Erro ao executar ferramenta ${toolName}: ${toolError.message}`
              }
            ]
          }
        }, { headers: corsHeaders });
      }
    }

    // Método não reconhecido
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32601, message: `Método não suportado: ${method}` },
      id
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[MCP Route Error]:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32700, message: `Erro ao processar mensagem JSON-RPC: ${error.message}` },
        id: null
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
