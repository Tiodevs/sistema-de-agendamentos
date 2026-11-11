import pino, { type LoggerOptions } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.execArgv.includes('--test');

function prettyTransport(): LoggerOptions['transport'] {
  if (isProduction || isTest || process.env.LOG_PRETTY === 'false') return undefined;
  try {
    // Só existe em desenvolvimento (devDependency): sem ele, o log sai em JSON.
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
    };
  } catch {
    return undefined;
  }
}

/**
 * Logger estruturado da API (ARQ-05). Em produção cada linha é um JSON com `level`, `time`,
 * `msg` e os campos do contexto (`requestId`, `err`, …), que o Railway indexa. Nada de token,
 * senha ou cookie no log: os caminhos abaixo saem como `[redacted]`.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  base: { service: 'api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.currentPassword',
      '*.newPassword',
      '*.token',
    ],
    censor: '[redacted]',
  },
  transport: prettyTransport(),
});

export type Logger = typeof logger;
