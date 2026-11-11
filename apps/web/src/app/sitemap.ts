import type { MetadataRoute } from 'next';
import { PUBLIC_ROUTES, SITE_URL } from '@/lib/site';

// UX-14: /sitemap.xml só com as rotas públicas. Sem `lastModified`: não há data real de
// atualização dessas páginas para informar.
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: route === '/' ? SITE_URL : `${SITE_URL}${route}`,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.5,
  }));
}
