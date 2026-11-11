import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// UX-14: /robots.txt. As rotas privadas e de token não entram em `disallow` de propósito: elas
// já saem com `noindex` no HTML (layouts de cada área), e bloquear aqui impediria o buscador de
// ler esse `noindex`. Só a API fica de fora do rastreamento.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
