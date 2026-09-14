import { appUrl, firstName } from './brand';
import { renderBrandedEmail } from './layout';

export function passwordChangedEmail(name: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Sua senha da Leemia foi alterada',
    ...renderBrandedEmail({
      preview: 'Se não foi você, redefina a senha imediatamente.',
      title: 'Senha alterada',
      greeting: `Olá, ${first}.`,
      intro:
        'A senha da sua conta na Leemia foi alterada agora. As outras sessões abertas foram encerradas. Se você fez essa alteração, nenhuma ação é necessária.',
      details: [
        { label: 'O que mudou', value: 'Senha da conta' },
        { label: 'Sessões', value: 'Os acessos anteriores foram desconectados' },
      ],
      cta: { label: 'Não fui eu — redefinir senha', href: `${appUrl()}/forgot-password` },
      footnote: 'Se você reconhece esta alteração, pode ignorar este aviso.',
      useCidImages,
    }),
  };
}
