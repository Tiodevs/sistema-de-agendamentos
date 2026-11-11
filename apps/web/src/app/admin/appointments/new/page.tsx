'use client';

import { BookingWizard } from '@/components/booking/booking-wizard';

/** Agendamento feito pelo admin: o mesmo assistente do cliente, com a escolha do cliente (ARQ-08). */
export default function NewAppointmentPage() {
  return <BookingWizard mode="admin" />;
}
