import { firstName } from './brand';
import { renderBrandedEmail } from './layout';

/**
 * Convite para o cliente cadastrado pela recepção criar a senha e acompanhar os horários (UX-03).
 * O link é o mesmo de "criar nova senha": abrir prova que a pessoa é dona do e-mail.
 */
export function accountActivationEmail(name: string, activateUrl: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Sua conta na Leemia',
    ...renderBrandedEmail({
      preview: 'Crie sua senha para ver e marcar horários. O link vale por 7 dias.',
      title: 'Crie sua senha',
      greeting: `Olá, ${first}.`,
      intro:
        'O estúdio cadastrou você na Leemia. Crie uma senha para ver seus horários, remarcar e agendar pelo site quando quiser.',
      details: [
        { label: 'Validade', value: '7 dias' },
        { label: 'Uso', value: 'Este link funciona apenas uma vez' },
      ],
      cta: { label: 'Criar senha', href: activateUrl },
      footnote: 'Se você não é cliente da Leemia, ignore este e-mail.',
      useCidImages,
    }),
  };
}
