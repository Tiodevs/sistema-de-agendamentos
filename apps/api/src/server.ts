import 'dotenv/config';
import { getJwtSecret } from './lib/jwt';
import { app } from './app';

getJwtSecret();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    console.log(`Swagger docs em http://localhost:${PORT}/api/docs`);
  }
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
