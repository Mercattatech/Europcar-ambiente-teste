import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { AI_TOOLS_DEFINITIONS, executeAITool } from '@/lib/ai/aiTools';
import { checkAdmin } from '@/lib/checkAdmin';

export const dynamic = 'force-dynamic';

/**
 * Chave de API dedicada ao MCP. SEM valor padrão: se MCP_API_KEY não estiver definida,
 * o acesso por chave fica desativado (só sessão de administrador do painel).
 */
const MCP_KEY = (process.env.MCP_API_KEY || '').trim();

function keyMatches(candidate: string): boolean {
  if (!MCP_KEY || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(MCP_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

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
  if (keyMatches(token) || keyMatches(xMcpKey) || keyMatches(queryKey)) {
    return true;
  }

  // 2. Acesso autenticado via cookie de sessão do painel — somente administradores
  return await checkAdmin().catch(() => false);
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
    // O handshake SSE exige autenticação (antes vazava a chave na URL do endpoint)
    if (!isAuth) {
      return NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401, headers: corsHeaders }
      );
    }
    const encoder = new TextEncoder();
    // Só devolve a chave se o próprio cliente a enviou na query string (ele já a conhece)
    const queryKey = new URL(request.url).searchParams.get('key') || '';
    const endpointUrl = keyMatches(queryKey) ? `${fullUrl}?key=${encodeURIComponent(queryKey)}` : fullUrl;
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

  // Descoberta pública: só informa que está online. Ferramentas só para quem está autenticado.
  if (!isAuth) {
    return NextResponse.json({
      status: 'ONLINE',
      server: 'Europcar Brasil MCP Server',
      protocolVersion: '2024-11-05',
      authenticated: false,
    }, { headers: corsHeaders });
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
            "Authorization": "Bearer <valor de MCP_API_KEY>"
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
            version: '1.1.0'
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
