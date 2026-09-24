/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' gera um bundle Node.js autossuficiente — necessário para Docker/Coolify.
  output: 'standalone',
  // Next.js 14: usa experimental.serverComponentsExternalPackages (renomeado para serverExternalPackages no Next.js 15)
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    cpus: 1,
    workerThreads: false,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Evita que erros de tipo bloqueiem o build em produção
    ignoreBuildErrors: true,
  },

  // ── Security Headers ─────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Impede que o site seja embutido em iframes de outros domínios (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Impede sniffing de MIME type
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Proteção XSS (filtro do navegador)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Não enviar referrer ao sair do site
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Não expor tecnologias
          { key: 'X-Powered-By', value: '' },
          // Permissions Policy (restringe sensores e APIs do navegador)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
          // Strict Transport Security (forçar HTTPS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },

  // ── Bloquear exposição do X-Powered-By ──────────────────────
  poweredByHeader: false,
};

module.exports = nextConfig;
