import { appUrl, firstName } from './brand';
import { renderBrandedEmail } from './layout';

export function emailChangeNoticeEmail(name: string, newEmail: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Pedido para alterar o e-mail da sua conta Leemia',
    ...renderBrandedEmail({
      preview: 'Se não foi você, ignore este aviso — o e-mail só muda depois da confirmação.',
      title: 'Alteração de e-mail',
      greeting: `Olá, ${first}.`,
      intro:
        'Alguém pediu para trocar o e-mail desta conta. A mudança só acontece se o novo endereço for confirmado. Se não foi você, sua senha e este e-mail continuam valendo.',
      details: [
        { label: 'Novo e-mail pedido', value: newEmail },
        { label: 'O que fazer', value: 'Se não reconhece, altere a senha' },
      ],
      cta: { label: 'Redefinir senha', href: `${appUrl()}/forgot-password` },
      footnote:
        'O e-mail atual desta conta não muda até alguém confirmar o link enviado ao endereço novo.',
      useCidImages,
    }),
  };
}
