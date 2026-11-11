import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { HomeGate } from '@/components/home-gate';
import { SESSION_COOKIE, SESSION_COOKIE_VALUE } from '@/lib/session-cookie';
import { SITE_IMAGE, SITE_NAME, SITE_URL } from '@/lib/site';

const HOME_DESCRIPTION =
  'Marque corte, barba, hidratação e mais em poucos toques. Escolha o profissional e o horário, com confirmação por e-mail.';

export const metadata: Metadata = {
  // UX-14: `absolute` para a home não ganhar o sufixo "· Leemia" do template.
  title: { absolute: 'Leemia — Agenda online do estúdio' },
  alternates: { canonical: '/' },
  description: HOME_DESCRIPTION,
  openGraph: {
    title: 'Leemia — Agenda online do estúdio',
    description: HOME_DESCRIPTION,
    images: [SITE_IMAGE],
    url: '/',
    siteName: SITE_NAME,
    locale: 'pt_BR',
    type: 'website',
  },
};

// UX-14: dados estruturados do estúdio. Só o que o código já sabe (nome, endereço do site,
// descrição e imagem da landing); endereço, telefone e horário não estão cadastrados em lugar
// nenhum do front, então ficam de fora em vez de inventados.
const HOME_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'HairSalon',
  '@id': `${SITE_URL}/#estudio`,
  name: SITE_NAME,
  url: SITE_URL,
  description: HOME_DESCRIPTION,
  image: `${SITE_URL}${SITE_IMAGE}`,
};

/** "<" escapado para o JSON não conseguir fechar a tag <script>. */
const HOME_JSON_LD_HTML = JSON.stringify(HOME_JSON_LD).replace(/</g, '\\u003c');

// ARQ-11: o cookie de sessão (sem o token) diz ao servidor se manda a landing ou a casca do
// painel no primeiro HTML. Ler o cookie torna "/" dinâmica; é o preço de a landing não piscar
// para quem está logado.
export default async function Page() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.get(SESSION_COOKIE)?.value === SESSION_COOKIE_VALUE;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: HOME_JSON_LD_HTML }} />
      <HomeGate hasSessionHint={hasSession} />
    </>
  );
}
