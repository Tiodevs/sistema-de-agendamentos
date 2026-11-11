import path from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants';

const LOCAL_API_URL = 'http://localhost:3001';

function withoutTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

/**
 * ARQ-09: endereço público da API. O valor entra no bundle durante o build, então produção sem
 * a variável sairia chamando `localhost:3001` no navegador do cliente. Melhor quebrar o build.
 */
function publicApiUrl(phase: string) {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!value) {
    if (phase === PHASE_PRODUCTION_BUILD && process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_API_URL não está definida. O build de produção precisa do endereço público ' +
          'da API (ex.: NEXT_PUBLIC_API_URL=https://api.exemplo.com.br). Veja apps/web/.env.example.',
      );
    }
    return LOCAL_API_URL;
  }

  try {
    return withoutTrailingSlash(new URL(value).toString());
  } catch {
    throw new Error(
      `NEXT_PUBLIC_API_URL inválida: "${value}". Use a URL completa, com http:// ou https://.`,
    );
  }
}

/**
 * SEC-07 (curto prazo): CSP e cabeçalhos de segurança em todas as rotas.
 *
 * `'unsafe-inline'` em script-src fica por enquanto: o Next injeta scripts inline na hidratação
 * e o layout tem dois scripts de bootstrap (tema e abertura). Trocar por nonce exige gerar o
 * cabeçalho no middleware a cada requisição, o que torna todas as páginas dinâmicas. É o próximo
 * passo, não está feito aqui. Mesmo assim esta CSP já barra script e frame de outra origem,
 * `<object>`, `<base>` e envio de formulário para fora.
 */
function securityHeaders(apiOrigin: string, isDev: boolean) {
  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' só no dev: o React Refresh e os source maps do Next dependem dele.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    // Tailwind/Next, GSAP e o sonner escrevem estilo inline.
    "style-src 'self' 'unsafe-inline'",
    // Avatares vêm da API (/api/users/:id/avatar); blob: e data: são o recorte da foto de perfil.
    `img-src 'self' data: blob: ${apiOrigin}`,
    // Fontes do next/font são servidas pelo próprio app.
    "font-src 'self' data:",
    // No dev, o hot reload usa WebSocket.
    `connect-src 'self' ${apiOrigin}${isDev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ];
}

export default function nextConfig(phase: string): NextConfig {
  const apiUrl = publicApiUrl(phase);
  const headers = securityHeaders(new URL(apiUrl).origin, phase === PHASE_DEVELOPMENT_SERVER);
  // ARQ-06: destino do proxy /api por variável. API_PROXY_URL serve quando o servidor do Next
  // alcança a API por outro endereço (rede interna do Docker, por exemplo).
  const proxyTarget = withoutTrailingSlash(process.env.API_PROXY_URL?.trim() || apiUrl);

  return {
    // Imagem Docker (NEXT_OUTPUT=standalone): servidor Node autocontido em .next/standalone.
    // Na Vercel e no dev local nada muda.
    ...(process.env.NEXT_OUTPUT === 'standalone'
      ? { output: 'standalone', outputFileTracingRoot: path.join(__dirname, '../..') }
      : {}),
    transpilePackages: ['gsap', '@gsap/react'],
    // O lint roda uma vez só, pelo `eslint.config.mjs` da raiz (`npm run lint` e a CI). O lint
    // embutido do `next build` não enxerga essa configuração e só repetiria o trabalho.
    eslint: { ignoreDuringBuilds: true },
    async headers() {
      return [{ source: '/:path*', headers }];
    },
    async rewrites() {
      return [{ source: '/api/:path*', destination: `${proxyTarget}/api/:path*` }];
    },
  };
}
