import 'dotenv/config';
import { emailService } from '../src/services/email.service';

const email = process.argv[2];
const name = process.argv[3] || email?.split('@')[0] || 'cliente';

async function main() {
  if (!email) {
    console.error('Uso: tsx scripts/send-welcome-email.ts email@exemplo.com "Nome"');
    process.exit(1);
  }

  await emailService.sendWelcome({
    id: email,
    name,
    email,
  });
  console.log(`E-mail de boas-vindas enviado para ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
