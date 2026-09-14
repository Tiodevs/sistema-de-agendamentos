import { firstName } from './brand';
import { renderBrandedEmail } from './layout';

export function passwordResetEmail(name: string, resetUrl: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Redefinir sua senha da Leemia',
    ...renderBrandedEmail({
      preview: 'Este link expira em 30 minutos e só pode ser usado uma vez.',
      title: 'Redefinir senha',
      greeting: `Olá, ${first}.`,
      intro:
        'Recebemos um pedido para redefinir a senha da sua conta. Se foi você, continue pelo botão abaixo. Se não foi, ignore este e-mail — sua senha permanece a mesma.',
      details: [
        { label: 'Validade', value: '30 minutos' },
        { label: 'Uso', value: 'Este link funciona apenas uma vez' },
      ],
      cta: { label: 'Redefinir senha', href: resetUrl },
      footnote: 'Não encaminhe este e-mail. Quem tiver o link pode alterar a senha da sua conta.',
      useCidImages,
    }),
  };
}
