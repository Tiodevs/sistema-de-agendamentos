import 'dotenv/config';
import { emailService } from '../src/services/email.service';

const to = process.argv[2] || 'delivered@resend.dev';

async function main() {
  const appointment = {
    id: `test-${Date.now()}`,
    date: new Date('2026-09-18T17:00:00.000-03:00'),
    price: 90,
    notes: 'Prefiro o horário da tarde',
    client: { name: 'Felipe Santos', email: to },
    product: { name: 'Design de sobrancelha', duration: 45 },
    employee: { name: 'Marina Costa', email: to },
  };

  await emailService.sendAppointmentScheduled(appointment);
  console.log(`E-mail de agendamento enviado para ${to}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
