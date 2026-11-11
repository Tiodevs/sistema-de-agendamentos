'use client';

import { BookingWizard } from '@/components/booking/booking-wizard';

/** Agendamento do cliente. O assistente é o mesmo do admin (ARQ-08). */
export default function BookPage() {
  return <BookingWizard mode="client" />;
}
