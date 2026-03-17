import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
  console.log(`� Swagger docs em http://localhost:${PORT}/api/docs`);
  console.log(`�📋 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
