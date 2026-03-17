import swaggerJsdoc from 'swagger-jsdoc';

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
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de Desenvolvimento',
      },
    ],
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
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
