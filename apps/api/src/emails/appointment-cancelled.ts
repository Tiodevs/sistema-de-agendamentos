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

export function appointmentCancelledEmail(data: AppointmentEmailData, useCidImages = true) {
  const name = firstName(data.clientName);

  return {
    subject: `Agendamento cancelado: ${data.productName}`,
    ...renderBrandedEmail({
      preview: `${name}, o horário de ${data.productName} foi cancelado.`,
      title: 'Agendamento cancelado',
      greeting: `Olá, ${name}.`,
      intro: 'O horário abaixo foi cancelado. Quando quiser, você pode escolher um novo horário.',
      details: [
        { label: 'Serviço', value: data.productName },
        { label: 'Profissional', value: data.professionalName },
        { label: 'Data', value: formatLongDate(data.date) },
        { label: 'Horário', value: formatTime(data.date) },
        { label: 'Duração', value: formatDuration(data.duration) },
        { label: 'Valor', value: formatCurrency(data.price) },
      ],
      cta: { label: 'Agendar de novo', href: `${appUrl()}/book` },
      footnote: 'Se o cancelamento não foi feito por você, responda este e-mail.',
      useCidImages,
    }),
  };
}
