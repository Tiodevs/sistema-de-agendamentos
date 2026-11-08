import {
  appUrl,
  firstName,
  formatCurrency,
  formatDuration,
  formatLongDate,
  formatTime,
} from './brand';
import { renderBrandedEmail } from './layout';
import type { AppointmentEmailData } from './appointment-scheduled';

export interface AppointmentCancelledEmailData extends AppointmentEmailData {
  /** Quem cancelou: o próprio cliente ou o estúdio (admin, profissional ou mudança de expediente). */
  cancelledBy?: 'client' | 'studio';
  /** Motivo mostrado ao cliente quando o estúdio cancela (ex.: "Estúdio fechado em 24/12"). */
  reason?: string | null;
}

export function appointmentCancelledEmail(
  data: AppointmentCancelledEmailData,
  useCidImages = true,
) {
  const name = firstName(data.clientName);
  const byStudio = data.cancelledBy === 'studio';
  const reason = data.reason?.trim();

  const details = [
    { label: 'Serviço', value: data.productName },
    { label: 'Profissional', value: data.professionalName },
    { label: 'Data', value: formatLongDate(data.date) },
    { label: 'Horário', value: formatTime(data.date) },
    { label: 'Duração', value: formatDuration(data.duration) },
    { label: 'Valor', value: formatCurrency(data.price) },
  ];
  if (byStudio && reason) {
    details.unshift({ label: 'Motivo', value: reason });
  }

  return {
    subject: `Agendamento cancelado: ${data.productName}`,
    ...renderBrandedEmail({
      preview: byStudio
        ? `${name}, precisamos cancelar o seu ${data.productName}.`
        : `${name}, o horário de ${data.productName} foi cancelado.`,
      title: 'Agendamento cancelado',
      greeting: `Olá, ${name}.`,
      intro: byStudio
        ? 'Precisamos cancelar o horário abaixo. Pedimos desculpas pelo transtorno: escolha um novo horário quando quiser.'
        : 'O horário abaixo foi cancelado. Quando quiser, você pode escolher um novo horário.',
      details,
      cta: { label: 'Agendar de novo', href: `${appUrl()}/book` },
      footnote: byStudio
        ? 'Ficou alguma dúvida? Responda este e-mail que a gente ajuda a encontrar outro horário.'
        : 'Se o cancelamento não foi feito por você, responda este e-mail.',
      useCidImages,
    }),
  };
}
