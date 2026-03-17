import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { router } from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// Middlewares de segurança e parsing
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api', router);

// Handler de erros global
app.use(errorHandler);

export { app };
