import {
  appUrl,
  displayName,
  firstName,
  formatCurrency,
  formatDuration,
  formatLongDate,
  formatTime,
} from './brand';
import { renderBrandedEmail } from './layout';
import type { AppointmentEmailData } from './appointment-scheduled';

export function professionalNewAppointmentEmail(data: AppointmentEmailData, useCidImages = true) {
  const name = firstName(data.professionalName);
  const client = displayName(data.clientName);

  return {
    subject: `Novo agendamento: ${data.productName} · ${formatTime(data.date)}`,
    ...renderBrandedEmail({
      preview: `${client} agendou ${data.productName} com você.`,
      title: 'Você tem um novo horário',
      greeting: `Olá, ${name}.`,
      intro: `${client} acabou de reservar um horário com você na Leemia.`,
      details: [
        { label: 'Cliente', value: client },
        { label: 'Serviço', value: data.productName },
        { label: 'Data', value: formatLongDate(data.date) },
        { label: 'Horário', value: formatTime(data.date) },
        { label: 'Duração', value: formatDuration(data.duration) },
        { label: 'Valor', value: formatCurrency(data.price) },
      ],
      cta: { label: 'Ver minha agenda', href: `${appUrl()}/professional/agenda` },
      footnote: 'Confirme o atendimento pela agenda do profissional quando estiver pronto.',
      useCidImages,
    }),
  };
}
