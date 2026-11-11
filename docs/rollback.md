# Rollback

O caminho de volta quando a fumaça de produção do `deploy.yml` falha ou um problema aparece depois de uma publicação. Nada volta sozinho: quem opera escolhe o que voltar.

## Antes de voltar

- **Só o web quebrou?** Volte só o web (passo 2). A API nova continua servindo o web anterior, porque as rotas antigas continuam lá.
- **A API quebrou?** Volte primeiro o web, se o web novo depende de rota nova, e depois a API (passo 1). Ao contrário, o web novo ficaria chamando uma rota que sumiu.
- **A versão trouxe migration?** O banco não volta. O código anterior só funciona no schema novo se a migration foi aditiva (expand and contract: acrescentar numa versão, parar de usar na seguinte, remover na outra). Se a migration removeu ou renomeou algo que o código anterior usa, não volte a API: corrija para frente, com uma pull request nova pela CI e pelo `deploy.yml`.

## 1. API no Railway

1. Railway, projeto `Agendamentos`, ambiente `production`, serviço `api`, aba Deployments.
2. No último deployment que estava bom, menu ⋮ > Rollback.
3. Acompanhe o log do pre-deploy (`npm run db:deploy --workspace=api`): se a checagem ou o `prisma migrate deploy` falhar, o Railway mantém a versão atual no ar.
4. `GET https://api-production-ac23.up.railway.app/api/health` deve devolver em `build` o commit da versão anterior.

## 2. Web na Vercel

1. Vercel, projeto `sistema-de-agendamento-web`, aba Deployments.
2. No último deployment de produção que estava bom, menu ⋮ > Instant Rollback. A troca vale para o domínio `agendamento.mefelipe.com.br` em segundos.
3. Depois de um Instant Rollback, a Vercel deixa de ligar o domínio de produção sozinha nas implantações novas. Quando a correção sair pelo `deploy.yml`, promova a implantação nova (Promote, ou `vercel promote <url>`) para o domínio voltar a acompanhar os deploys.

## 3. Conferir

Da raiz do repositório, sem `--commit`:

```bash
node .github/scripts/smoke.mjs --api https://api-production-ac23.up.railway.app --web https://agendamento.mefelipe.com.br
```

## 4. Depois

Abra uma issue (modelo Bug) com o commit que quebrou e o que a fumaça acusou, e corrija para frente: pull request, CI verde, `deploy.yml` com a aprovação de production.
