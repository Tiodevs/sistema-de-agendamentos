import type { Metadata } from 'next';

// UX-14: dados do site usados por metadata, robots, sitemap e JSON-LD. Ficam aqui (e não em
// components/logo.tsx) porque aquele arquivo é 'use client' e estes valores são lidos no servidor.
export const SITE_URL = 'https://agendamento.mefelipe.com.br';
export const SITE_NAME = 'Leemia';
/**
 * Sufixo da marca no título da aba (UX-14). Um layout que tem rotas filhas com título próprio
 * precisa repetir o `template`: um `title` em texto simples corta o template para os filhos.
 */
export const TITLE_TEMPLATE = `%s · ${SITE_NAME}`;
export const SITE_DESCRIPTION =
  'Agenda online do estúdio Leemia. Marque serviços, escolha o profissional e confirme o horário.';
export const SITE_IMAGE = '/marketing/leemia-light-waves.png';

/** Rotas públicas que valem para busca; o resto é área logada ou link de e-mail. */
export const PUBLIC_ROUTES = ['/', '/login', '/register'] as const;

/** Área logada e telas de token: fora do índice e sem seguir links. */
export const NO_INDEX: Metadata['robots'] = { index: false, follow: false };
