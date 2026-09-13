import { appUrl, firstName } from './brand';
import { renderBrandedEmail } from './layout';

export function welcomeEmail(name: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Bem-vindo à Leemia',
    ...renderBrandedEmail({
      preview: `${first}, sua conta está pronta. Agende o próximo horário em poucos toques.`,
      title: 'Que bom ter você aqui',
      greeting: `Olá, ${first}.`,
      intro:
        'Sua conta na Leemia está pronta. Escolha o serviço, o profissional e o horário que funcionam para você.',
      details: [
        { label: 'Próximo passo', value: 'Agendar um horário' },
        { label: 'Onde', value: 'Pelo aplicativo, em poucos toques' },
      ],
      cta: { label: 'Agendar agora', href: `${appUrl()}/book` },
      footnote: 'Você vai receber um e-mail sempre que um horário for reservado ou cancelado.',
      useCidImages,
    }),
  };
}
