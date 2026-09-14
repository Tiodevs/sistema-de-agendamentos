import { firstName } from './brand';
import { renderBrandedEmail } from './layout';

export function emailChangeConfirmEmail(name: string, confirmUrl: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Confirme o novo e-mail da sua conta Leemia',
    ...renderBrandedEmail({
      preview: 'Este link expira em 30 minutos e só pode ser usado uma vez.',
      title: 'Confirmar e-mail',
      greeting: `Olá, ${first}.`,
      intro:
        'Recebemos um pedido para usar este endereço como e-mail da sua conta. Se foi você, confirme pelo botão abaixo. Se não foi, ignore este e-mail — o e-mail atual permanece o mesmo.',
      details: [
        { label: 'Validade', value: '30 minutos' },
        { label: 'Uso', value: 'Este link funciona apenas uma vez' },
      ],
      cta: { label: 'Confirmar e-mail', href: confirmUrl },
      footnote:
        'Não encaminhe este e-mail. Quem tiver o link pode apontar a conta para este endereço.',
      useCidImages,
    }),
  };
}
