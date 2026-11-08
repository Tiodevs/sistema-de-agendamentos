import {
  appUrl,
  displayName,
  firstName,
  formatDuration,
  formatLongDate,
  formatTime,
} from './brand';
import { renderBrandedEmail } from './layout';
import type { AppointmentEmailData } from './appointment-scheduled';

/** Aviso ao profissional de que um horário da agenda dele ficou livre (DOM-09). */
export function professionalAppointmentCancelledEmail(
  data: AppointmentEmailData & { cancelledBy?: 'client' | 'studio' },
  useCidImages = true,
) {
  const name = firstName(data.professionalName);
  const client = displayName(data.clientName);
  const who = data.cancelledBy === 'client' ? client : 'O estúdio';

  return {
    subject: `Horário cancelado: ${data.productName} · ${formatTime(data.date)}`,
    ...renderBrandedEmail({
      preview: `${who} cancelou ${data.productName} de ${formatLongDate(data.date)}.`,
      title: 'Um horário ficou livre',
      greeting: `Olá, ${name}.`,
      intro:
        data.cancelledBy === 'client'
          ? `${client} cancelou o horário abaixo. O espaço já está livre para outra reserva.`
          : `O estúdio cancelou o horário abaixo, de ${client}. O espaço já está livre para outra reserva.`,
      details: [
        { label: 'Cliente', value: client },
        { label: 'Serviço', value: data.productName },
        { label: 'Data', value: formatLongDate(data.date) },
        { label: 'Horário', value: formatTime(data.date) },
        { label: 'Duração', value: formatDuration(data.duration) },
      ],
      cta: { label: 'Ver minha agenda', href: `${appUrl()}/professional/agenda` },
      footnote: 'Você recebe este aviso sempre que um horário da sua agenda é cancelado.',
      useCidImages,
    }),
  };
}
