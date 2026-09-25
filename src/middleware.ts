import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware que intercepta requisições ANTES da renderização.
 * Verifica se o site está em modo manutenção e redireciona se necessário.
 * Rotas do painel, API, assets estáticos e next internals são excluídas.
 */
export async function middleware(request: NextRequest) {
   const { pathname } = request.nextUrl;

   // Ignorar rotas que não devem ser redirecionadas
   if (
      pathname.startsWith('/painel') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.includes('.')
   ) {
      return NextResponse.next();
   }

   try {
      // Construir URL absoluta para a API de status
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('host') || request.nextUrl.host;
      // Cache-bust: adicionar timestamp para garantir que nunca use cache
      const statusUrl = `${protocol}://${host}/api/maintenance/status?_t=${Date.now()}`;

      const res = await fetch(statusUrl, {
         method: 'GET',
         cache: 'no-store',
         headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
         },
      });

      if (res.ok) {
         const data = await res.json();
         if (data.maintenance && data.redirectUrl) {
            // Redirect 307 (temporário) para o URL cadastrado
            return NextResponse.redirect(data.redirectUrl, 307);
         }
      }
   } catch (error) {
      // Em caso de erro, não bloqueia o site — deixa passar
      console.error('Maintenance middleware error:', error);
   }

   // ── Tracking de Referral (cupom por link) ──
   const refCode = request.nextUrl.searchParams.get('ref');
   const utmSource = request.nextUrl.searchParams.get('utm_source');
   const utmMedium = request.nextUrl.searchParams.get('utm_medium');
   const utmCampaign = request.nextUrl.searchParams.get('utm_campaign');
   const utmContent = request.nextUrl.searchParams.get('utm_content');

   const response = addSecurityHeaders(NextResponse.next());

   if (refCode) {
      // Salvar cookie com o código de referral (30 dias)
      response.cookies.set('ref_code', refCode.toUpperCase(), {
         maxAge: 60 * 60 * 24 * 30, // 30 dias
         path: '/',
         httpOnly: false,
         sameSite: 'lax',
      });

      // Salvar UTMs se presentes
      if (utmSource) response.cookies.set('utm_source', utmSource, { maxAge: 60 * 60 * 24 * 30, path: '/' });
      if (utmMedium) response.cookies.set('utm_medium', utmMedium, { maxAge: 60 * 60 * 24 * 30, path: '/' });
      if (utmCampaign) response.cookies.set('utm_campaign', utmCampaign, { maxAge: 60 * 60 * 24 * 30, path: '/' });
      if (utmContent) response.cookies.set('utm_content', utmContent, { maxAge: 60 * 60 * 24 * 30, path: '/' });

      // Registrar evento de referral (fire-and-forget via API)
      try {
         const protocol = request.headers.get('x-forwarded-proto') || 'https';
         const host = request.headers.get('host') || request.nextUrl.host;
         fetch(`${protocol}://${host}/api/referral-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               couponCode: refCode.toUpperCase(),
               event: 'LINK_OPENED',
               source: utmSource,
               medium: utmMedium,
               campaign: utmCampaign,
               content: utmContent,
               referrer: request.headers.get('referer') || null,
               ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
               userAgent: request.headers.get('user-agent') || null,
            }),
         }).catch(() => {}); // fire-and-forget
      } catch { /* ignore */ }
   }

   return response;
}

/** Adiciona headers de segurança a toda response */
function addSecurityHeaders(response: NextResponse): NextResponse {
   response.headers.set('X-Frame-Options', 'SAMEORIGIN');
   response.headers.set('X-Content-Type-Options', 'nosniff');
   response.headers.set('X-XSS-Protection', '1; mode=block');
   response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
   response.headers.delete('X-Powered-By');
   return response;
}

export const config = {
   matcher: [
      /*
       * Match all request paths except:
       * - api (API routes)
       * - painel (admin panel)
       * - _next/static (static files)
       * - _next/image (image optimization)
       * - favicon.ico (favicon)
       * - Files with extensions (static assets)
       */
      '/((?!api|painel|_next/static|_next/image|favicon.ico).*)',
   ],
};
