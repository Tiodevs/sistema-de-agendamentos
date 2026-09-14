import type { Metadata } from 'next';
import { HomeGate } from '@/components/home-gate';

export const metadata: Metadata = {
  title: 'Leemia — Agenda online do estúdio',
  description:
    'Marque corte, barba, hidratação e mais em poucos toques. Escolha o profissional e o horário, com confirmação por e-mail.',
  openGraph: {
    title: 'Leemia — Agenda online do estúdio',
    description:
      'Marque corte, barba, hidratação e mais em poucos toques. Escolha o profissional e o horário, com confirmação por e-mail.',
    images: ['/marketing/leemia-light-waves.png'],
  },
};

export default function Page() {
  return <HomeGate />;
}
