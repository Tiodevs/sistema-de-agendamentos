import { firstName } from './brand';
import { renderBrandedEmail } from './layout';

/** Convite para o profissional ligar a conta dele ao cadastro feito pelo estúdio (SEC-03). */
export function employeeInviteEmail(name: string, acceptUrl: string, useCidImages = true) {
  const first = firstName(name);

  return {
    subject: 'Convite para a agenda da Leemia',
    ...renderBrandedEmail({
      preview: 'Aceite o convite para ver sua agenda. O link vale por 7 dias.',
      title: 'Você foi convidado para a agenda',
      greeting: `Olá, ${first}.`,
      intro:
        'O estúdio cadastrou você como profissional na Leemia. Aceite o convite para ver sua agenda e atualizar seus atendimentos. Se você já tem conta com este e-mail, é só entrar com ela; se não tem, você cria a senha na hora.',
      details: [
        { label: 'Validade', value: '7 dias' },
        { label: 'Uso', value: 'Este link funciona apenas uma vez' },
      ],
      cta: { label: 'Aceitar convite', href: acceptUrl },
      footnote:
        'Não encaminhe este e-mail: quem abrir o link pode ligar a própria conta à sua agenda. Se você não esperava este convite, ignore.',
      useCidImages,
    }),
  };
}
