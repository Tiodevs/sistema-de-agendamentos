## O que muda

<!-- Resumo da mudança e o motivo. -->

## Como testei

- [ ] `npm test` (unidade da API e do web)
- [ ] `npm run build`
- [ ] E2E contra o Docker (`npm run test:e2e`), quando mudou agenda ou autenticação
- [ ] Telas no navegador, quando a interface mudou

## Capturas de tela

<!-- Quando a interface mudar. -->

## Checklist

- [ ] Nenhum `.env`, chave, senha ou e-mail pessoal no diff: o repositório é público
- [ ] `schema.prisma` mudou? A migration está em `apps/api/prisma/migrations` e não quebra a versão anterior do código
- [ ] Rota nova ou alterada da API documentada no comentário `@swagger`
- [ ] O web depende de rota nova da API? O `deploy.yml` já publica a API antes do web
