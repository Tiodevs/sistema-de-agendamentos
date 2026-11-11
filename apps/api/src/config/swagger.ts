import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Servidores listados no Swagger (ARQ-06): a URL pública deste ambiente (`PUBLIC_API_URL`, ou o
 * domínio que o Railway expõe) e, fora de produção, o localhost da porta em uso.
 */
function swaggerServers() {
  const servers: Array<{ url: string; description: string }> = [];
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const publicUrl =
    process.env.PUBLIC_API_URL?.trim() || (railwayDomain ? `https://${railwayDomain}` : '');
  if (publicUrl) {
    servers.push({ url: publicUrl.replace(/\/+$/, ''), description: 'Este ambiente' });
  }
  if (process.env.NODE_ENV !== 'production') {
    const local = `http://localhost:${process.env.PORT || 3001}`;
    if (!servers.some((server) => server.url === local)) {
      servers.push({ url: local, description: 'Desenvolvimento local' });
    }
  }
  return servers.length > 0 ? servers : [{ url: '/', description: 'Este servidor' }];
}

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Sistema de Agendamentos',
      version: '1.0.0',
      description:
        'Documentação da API do Sistema de Agendamentos. Esta API fornece endpoints para gerenciar agendamentos, usuários e serviços.',
      contact: {
        name: 'Suporte',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: swaggerServers(),
    tags: [
      {
        name: 'Health',
        description: 'Verificação de saúde da API',
      },
      {
        name: 'Auth',
        description: 'Autenticação e registro de usuários',
      },
      {
        name: 'Products',
        description: 'Gerenciamento de produtos/serviços',
      },
      {
        name: 'Employees',
        description: 'Gerenciamento de funcionários e atribuição de produtos',
      },
      {
        name: 'Appointments',
        description: 'Agendamentos e disponibilidade de horários',
      },
      {
        name: 'Admin',
        description: 'Operação: fila de e-mails',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
