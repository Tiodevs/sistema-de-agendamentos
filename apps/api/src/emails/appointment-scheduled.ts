import {
  appUrl,
  firstName,
  formatCurrency,
  formatDuration,
  formatLongDate,
  formatTime,
} from './brand';
import { renderBrandedEmail } from './layout';

export interface AppointmentEmailData {
  clientName: string;
  productName: string;
  professionalName: string;
  date: Date;
  duration: number;
  price: number;
  notes?: string | null;
}

export function appointmentScheduledEmail(data: AppointmentEmailData, useCidImages = true) {
  const name = firstName(data.clientName);
  const when = `${formatLongDate(data.date)} às ${formatTime(data.date)}`;
  const details = [
    { label: 'Serviço', value: data.productName },
    { label: 'Profissional', value: data.professionalName },
    { label: 'Data', value: formatLongDate(data.date) },
    { label: 'Horário', value: formatTime(data.date) },
    { label: 'Duração', value: formatDuration(data.duration) },
    { label: 'Valor', value: formatCurrency(data.price) },
  ];

  if (data.notes?.trim()) {
    details.push({ label: 'Observação', value: data.notes.trim() });
  }

  return {
    subject: `Horário reservado: ${data.productName} · ${formatTime(data.date)}`,
    ...renderBrandedEmail({
      preview: `${name}, seu ${data.productName} com ${data.professionalName} está reservado.`,
      title: 'Seu horário está reservado',
      greeting: `Olá, ${name}.`,
      intro:
        'Recebemos seu agendamento na Leemia. Confira os detalhes abaixo e chegue alguns minutos antes.',
      details,
      cta: { label: 'Ver meus horários', href: `${appUrl()}/appointments` },
      footnote:
        'Se precisar remarcar ou cancelar, acesse o aplicativo. Responda este e-mail se quiser falar com a gente.',
      useCidImages,
    }),
    summary: when,
  };
}
