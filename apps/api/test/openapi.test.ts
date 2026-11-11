import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import swaggerJsdoc from 'swagger-jsdoc';

// O Swagger lê os comentários `@swagger` das rotas quando a API sobe. Um erro de YAML num deles
// não derruba nada: o trecho fica fora da documentação, com só um aviso no log. Aqui ele falha.
describe('documentação OpenAPI das rotas', () => {
  it('os comentários @swagger compilam sem erro de YAML', () => {
    // Caminho absoluto, com barras normais para o glob, para valer em qualquer cwd e no Windows.
    const routes = join(__dirname, '..', 'src', 'routes', '*.ts').replace(/\\/g, '/');
    const spec = swaggerJsdoc({
      definition: {
        openapi: '3.0.0',
        info: { title: 'API Sistema de Agendamentos', version: '1' },
      },
      apis: [routes],
      failOnErrors: true,
    }) as { paths?: Record<string, unknown> };

    const paths = Object.keys(spec.paths ?? {});
    assert.ok(paths.length > 0, `nenhuma rota documentada em ${routes}`);
    assert.ok(paths.includes('/api/health'), 'falta /api/health');
    assert.ok(paths.includes('/api/health/ready'), 'falta /api/health/ready');
  });
});
