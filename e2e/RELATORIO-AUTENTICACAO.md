# Relatório: segurança e integridade do fluxo de autenticação

Revisão de login, cadastro, sessão JWT, perfil, troca de senha autenticada e recuperação de conta (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/profile` e rotas `/api/auth/*`).

Nenhum código de produção foi alterado na passagem original deste relatório. As correções de 13/09/2026 estão resumidas abaixo; o que ficou de fora está em [Backlogs do projeto.md](../Backlogs%20do%20projeto.md).

### Status das correções (13/09/2026)

| Item                                                           | Situação                                           |
| -------------------------------------------------------------- | -------------------------------------------------- |
| Login inativo / timing / mensagem única                        | Feito (`401` genérico + hash dummy)                |
| Lockout simples por e-mail + IP real (`req.ip`)                | Feito, sem Redis                                   |
| Logout no servidor + `tokenVersion` + JWT padrão 12h + `HS256` | Feito (Bearer no `localStorage` permanece)         |
| Confirmação de e-mail no perfil                                | Feito                                              |
| Política de senha (maiúscula + especial) em criação/troca      | Feito; senhas antigas continuam válidas no login   |
| Token de reset no fragmento `#token=` (sem `sessionStorage`)   | Feito                                              |
| Cadastro paralelo `P2002` → 500                                | **Adiado** (pedido explícito)                      |
| Cookie `httpOnly` + refresh rotativo + Redis                   | **Adiado** (custo / origem cruzada Vercel↔Railway) |

O relatório de agendamento continua em [RELATORIO-INTEGRIDADE.md](./RELATORIO-INTEGRIDADE.md).

---

## O que já está sólido

- Senha com bcrypt (custo 12). `JWT_SECRET` é obrigatório para a API subir.
- Cadastro sempre cria `USER`; `role` / `active` no body são ignorados. O middleware recarrega `role` e `active` no banco a cada request — um JWT assinado com `role: ADMIN` para um cliente continua `USER`.
- Login usa a mesma mensagem (`E-mail ou senha inválidos`) para e-mail inexistente e senha errada.
- Pedido de reset: mensagem genérica, token **não** volta na resposta HTTP, hash SHA-256 no banco, validade de 30 minutos, uso único, pedidos anteriores invalidados, padding de ~250 ms e limite por IP + por e-mail.
- Reset recusa token inválido/expirado/reutilizado e **não** autentica a sessão; a UI tira o token da query (`replace`) e chama `logout()`.
- Troca de senha autenticada exige a senha atual, recusa repetir a mesma, devolve um JWT novo e invalida os anteriores via `passwordChangedAt` vs `iat`.
- Helmet + CORS restrito à origem do front. Swagger só fora de produção (ou com `SWAGGER_ENABLED`).
- Front: senha em `type=password`, confirmação no cadastro/reset, shells por papel, visitante vai para `/login`.

---

## Crítico para o cliente

### 1. Sessão só no `localStorage` — JWT vive 7 dias e o logout é só no browser

Token e `user` ficam em `localStorage`. Qualquer XSS na origem lê a sessão. `Sair` apaga o storage; o JWT continua válido na API até expirar (`JWT_EXPIRES_IN`, padrão 7 dias), salvo troca/reset de senha.

Não há denylist, refresh token nem cookie `httpOnly`. Quem copiar o Bearer usa a conta em outro dispositivo.

**Impacto:** roubo de sessão dura dias. Logout “não encerra” a conta de verdade.

**Melhoria:** cookie `httpOnly` + `Secure` + `SameSite`, TTL menor, refresh rotativo e logout no servidor (denylist ou versão de sessão).

### 2. Sem lockout; rate limit de login é frouxo e o IP é fácil de forjar

Login: 80 tentativas / 15 min **por IP**. O IP vem de `X-Forwarded-For` sem conferir se o hop é um proxy confiável. Rotacionar o header contorna o limite. O bucket é só memória: restart ou outro processo da API zera a conta.

Cadastro: 20/hora por IP (mesmo spoof). Troca de senha: 5/15 min por usuário (melhor).

**Impacto:** stuffing de credenciais e criação em massa de contas.

**Melhoria:** confiar só em `req.socket.remoteAddress` (ou no proxy real), Redis/store compartilhado, lockout progressivo por e-mail, CAPTCHA após N falhas.

### 3. Conta desativada responde `403 Conta desativada`

E-mail inexistente / senha errada → `401` genérico. Conta `active=false` → mensagem diferente. Dá para confirmar que o e-mail pertence a uma conta (ainda que desligada).

Login de e-mail inexistente também não faz `bcrypt.compare` dummy: a diferença de tempo ajuda enumeração.

**Melhoria:** mesma mensagem e mesmo tempo (hash dummy) para inexistente, inativo e senha errada.

### 4. Troca de e-mail no perfil sem verificação

`PATCH /profile` aceita um e-mail novo na hora. Sem link de confirmação no endereço novo (nem no antigo). Com sessão roubada, o atacante aponta a conta para a caixa dele e pede reset.

`409 E-mail já está em uso` no cadastro e no perfil também confirma contas existentes — esperado para UX, mas é enumeração.

**Melhoria:** confirmar o e-mail novo por token; opcionalmente mensagem genérica no cadastro (“se o e-mail estiver livre, enviamos o próximo passo”).

### 5. Política de senha só com tamanho (8–128)

`12345678` passa. Não há regra de complexidade, denylist de senhas vazadas nem checagem de senha comprometida.

**Impacto:** contas triviais de quebrar, ainda mais com o rate limit de login.

**Melhoria:** exigir mistura de classes, bloquear senhas comuns e, se possível, consultar Have I Been Pwned (k-anonymity).

### 6. Cadastro paralelo do mesmo e-mail pode virar `500`

O `findUnique` + `create` não trata `P2002`. Dois `POST /register` ao mesmo tempo passam da checagem e um estoura unique no Postgres. Confirmado no E2E: respostas `201` e `500`. O `errorHandler` não mapeia o erro de unicidade para `409`.

Coberto por `npm run test:e2e:gaps` (`dois cadastros simultâneos...`).

**Melhoria:** capturar unique do Prisma e responder `409`, de preferência num `create` único.

---

## Recuperação de conta

O desenho do reset é o ponto mais cuidado do módulo (hash, TTL, one-time, mensagem genérica, padding). Mesmo assim:

1. **Token na query do e-mail** (`/reset-password?token=...`) — vaza em histórico, logs de proxy e `Referer` se a página carregar terceiro. A UI remove a query; a corrida entre o GET e o `replace` existe.
2. **Token em `sessionStorage`** na tela de nova senha — XSS nessa página lê o token ainda válido.
3. **Domínio `leemia.dev` não recebe e-mail** (`canSendTo`). Contas de teste (e qualquer usuário real nesse domínio) nunca recebem o link. O pedido HTTP ainda responde 200 genérico.
4. **Happy path do e-mail não entra no E2E** sem interceptar a caixa ou inserir o hash no banco. Os testes cobrem pedido genérico, token inválido, strip da URL e recusa de token inventado. A invalidação de sessão depois da troca é coberta pela rota autenticada `POST /password`.

---

## JWT, autorização e superfície

| Tema                         | Situação                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Assinatura                   | `alg=none` e payload adulterado → `401`. Expirado → `401`.                                                             |
| Papel                        | Lido de novo no banco; JWT com `ADMIN` forjado não lista `/auth/clients`.                                              |
| Query string                 | `GET /me?token=` não autentica.                                                                                        |
| `GET /reset-password`        | não troca senha.                                                                                                       |
| CORS                         | origem do front refletida; `https://evil.example` não. Pedidos sem `Origin` (curl) passam — normal para API Bearer.    |
| Avatar                       | `GET /api/users/:id/avatar` é público. Sem foto → 404; com foto, quem souber o id baixa a imagem.                      |
| `jwt.verify`                 | não fixa `algorithms: ['HS256']`. jsonwebtoken 9 recusa `none` com secret string, mas o allowlist ainda é boa prática. |
| `iat` vs `passwordChangedAt` | tokens com `iat` no **mesmo segundo** da troca ainda passam (`iat < changedAtSec`). Janela de 1 s.                     |
| Stack em development         | `errorHandler` manda `stack` se `NODE_ENV=development`.                                                                |

---

## Integridade / UX

1. **Front autoriza só no cliente** — layouts redirecionam, mas a API é a regra de verdade. Os testes batem nas duas camadas.
2. **JWT antigo guarda e-mail velho** depois do `PATCH /profile`; a auth usa o `id`, então não é escalada de privilégio, só payload obsoleto até o próximo login.
3. **Sem 2FA.**
4. **Docs** (`docs/aplicacao.md`) ainda falam em senha mínima 6 e “upload de avatar inexistente”; o código exige 8 caracteres e já tem storage.
5. **Banco local = produção** — cadastro E2E cria `e2e.auth.*@leemia.dev` de verdade. Não apaga essas contas.
6. Rate limit de `forgot-password` é 8/hora por IP: não martelar essa rota na suíte.

---

## O que os testes cobrem

### Deve passar (`npm run test:e2e` e `npm run test:e2e:auth`)

**API**

- Login válido: JWT com `id` / `email` / `role`, sem hash na resposta.
- E-mail inexistente e senha errada → mesma `401`.
- Validação de e-mail/senha vazia; cadastro com senha/nome curtos.
- Cadastro `USER` mesmo com `role: ADMIN` no body; e-mail duplicado → `409`.
- `/me` exige Bearer e não vaza `password` / `passwordChangedAt`.
- Perfil próprio atualiza nome; e-mail de outra conta → `409`; `role` no PATCH é ignorado.
- Troca de senha: senha atual obrigatória, não repete a atual, JWT antigo e segunda sessão → `401`, login só com a nova.
- Forgot-password: mesma mensagem, sem token no JSON.
- Reset com token ausente / curto / inventado → `400`; GET na rota não redefine.

**JWT / autorização / HTTP**

- Sem token, formato errado, lixo, `alg=none`, payload com `role` adulterado.
- Token só na query não autentica.
- JWT expirado (se `JWT_SECRET` estiver no `.env` da API).
- JWT HS256 de USER com `role: ADMIN` ainda é USER nas rotas admin.
- USER não acessa `/auth/clients`, `/dashboard/stats`, `/professional/dashboard`.
- `X-Content-Type-Options: nosniff`; CORS não reflete origem estranha.

**UI**

- Login grava JWT e abre o shell; senha errada não grava sessão.
- Senha começa oculta e o botão revela.
- Links para cadastro e “esqueceu a senha”.
- Cadastro autentica na home; senhas diferentes não chamam a API.
- Logado em `/login` → home; visitante em `/appointments`, `/admin`, `/professional` → `/login`.
- USER não permanece em `/admin` nem `/professional`.
- Sair limpa `localStorage`; `/appointments` volta ao login.
- Forgot-password mostra texto genérico + 30 minutos.
- Reset sem token → “Link inválido”; token inventado some da URL, vai para `sessionStorage` e a API recusa.
- `login?reset=1` avisa senha redefinida.
- Perfil: troca de senha na UI invalida o Bearer antigo e grava o novo.

### Regressão (`npm run test:e2e:gaps`)

- Dois `POST /register` simultâneos do mesmo e-mail → `201` + `409`, nunca `500`.

---

## Ordem sugerida das correções

1. Tratar unique do cadastro (`409` em vez de `500`) e unificar resposta/timing do login (incluindo conta inativa).
2. Rate limit por IP real + store compartilhado; baixar o teto de login e considerar lockout por e-mail.
3. Cookie `httpOnly` (ou pelo menos TTL curto + revogação no logout) e confirmar e-mail novo no perfil.
4. Endurecer política de senha; `algorithms: ['HS256']` no `jwt.verify`.
5. Evitar token de reset na query (fragment `#` ou página intermediária POST).
