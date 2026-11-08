import { firstName } from './brand';
import { renderBrandedEmail } from './layout';

/** Enviado no cadastro (e no "reenviar link"). Depois da confirmação, vai o e-mail de boas-vindas. */
export function emailVerificationEmail(name: string, confirmUrl: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Confirme seu e-mail na Leemia',
    ...renderBrandedEmail({
      preview: 'Confirme o e-mail para começar a agendar. O link vale por 24 horas.',
      title: 'Confirme seu e-mail',
      greeting: `Olá, ${first}.`,
      intro:
        'Sua conta na Leemia foi criada. Para reservar horários, confirme que este endereço é seu pelo botão abaixo. Se você não criou esta conta, ignore este e-mail.',
      details: [
        { label: 'Validade', value: '24 horas' },
        { label: 'Uso', value: 'Este link funciona apenas uma vez' },
      ],
      cta: { label: 'Confirmar e-mail', href: confirmUrl },
      footnote: 'Não encaminhe este e-mail: o link confirma a conta para quem o abrir.',
      useCidImages,
    }),
  };
}
