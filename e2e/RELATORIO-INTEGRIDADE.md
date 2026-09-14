# Relatório: segurança e integridade do fluxo de agendamento

Revisão do fluxo do cliente (`/book` → `POST /api/appointments/book`), da consulta de disponibilidade e das rotas vizinhas.

A interface só deixa confirmar um slot com `available: true`. A regra de verdade agora também está no servidor: `create` recusa horário fora da grade, e a reserva do profissional é serializada contra double-booking.

Os testes em `e2e/` separam:

- `npm run test:e2e` — comportamento esperado hoje (UI + conflitos + auth + overlap intencional do cliente).
- `npm run test:e2e:gaps` — regressão das correções de integridade/privacidade (deve passar após este trabalho).

---

## Crítico para o cliente

### 1. Agendar fora da grade — corrigido

`AppointmentService.create` reutiliza a grade da disponibilidade: expediente, dia fechado, dia especial, passado, alinhamento de 15 minutos e término até o fechamento.

**Impacto evitado:** um cliente autenticado não consegue mais marcar horário que a UI nem mostra.

### 2. Corrida no mesmo horário (double-booking) — corrigido

A criação trava o profissional com `SELECT … FOR UPDATE` dentro de uma transação e recusa o segundo `POST` com `409`. Há também constraint `EXCLUDE` no Postgres (`appointments_employee_no_overlap`) para o intervalo `[date, endDate)` nos status ativos.

**Impacto evitado:** dois clientes no mesmo horário do mesmo profissional.

### 3. O cliente pode se sobrepor com dois profissionais — comportamento mantido

O conflito continua **só por `employeeId`**. O mesmo `clientId` pode marcar `10:00` com a Marina e `10:00` com o Rafael.

Isso é regra de produto: a pessoa pode ter dois compromissos no mesmo horário com profissionais diferentes. Os testes estáveis cobrem esse caso como permitido (`201` + `201`).

### 4. Cancelar pela API — corrigido

`PATCH /:id/cancel` agora exige dono **e** as mesmas regras da tela: só `SCHEDULED`/`CONFIRMED` futuros. `COMPLETED`, `IN_PROGRESS` ou horário passado retornam `400`.

### 5. Token de conta desativada — já coberto

O `authMiddleware` consulta `user.active` (e invalida JWT se a senha mudou). Conta desligada pelo admin deixa de agendar na hora.

---

## Crítico para privacidade (IDOR) — corrigido

| Rota                                      | Depois da correção                                                 |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/appointments`                   | só `ADMIN`                                                         |
| `GET /api/appointments/:id`               | admin ou dono do agendamento; outro USER recebe `403`              |
| `GET /api/auth/clients`                   | `adminMiddleware`                                                  |
| `GET /api/employees`                      | USER recebe `id`, `name`, `avatar` e produtos; sem e-mail/telefone |
| `GET /api/products?includeInactive=true`  | `403` para USER                                                    |
| `GET /api/employees?includeInactive=true` | `403` para USER                                                    |

`GET /api/appointments/my` segue correto. A tela de agendar não mostra mais o telefone do profissional.

---

## Autorização e superfície de ataque

### JWT e sessão

- `JWT_SECRET` é obrigatório; sem a variável a API não sobe (não há mais `fallback-secret`).
- Token ainda no `localStorage` (`token` + `user`). Cookie httpOnly fica como melhoria futura.
- O middleware recarrega `role` e `active` no banco a cada request.
- CORS restrito a `CORS_ORIGINS` / `APP_URL` (padrão `http://localhost:3000`).

### Outros

- Rate limit em login, cadastro, `/book` e no fluxo de senha.
- Swagger em `/api/docs` só fora de produção, ou se `SWAGGER_ENABLED=true`.
- `UserShell` autoriza só `role === USER`. Profissional que abre `/book` é redirecionado para `/professional`; `POST /book` recusa quem não é cliente.
- Preço no `create` vem do produto. `clientId` no `/book` continua sobrescrito pelo token.

---

## Integridade operacional / UX

1. **Calendário bloqueia dia fechado** — domingo, feriado e dia com `isClosed` ficam desabilitados no date picker (horários de funcionamento + dias especiais).
2. **Um relógio** — grade, calendário e “hoje” usam `America/Sao_Paulo`.
3. **Dia especial** — seed e lookup de Natal usam a data civil em UTC (`YYYY-MM-DDT00:00:00.000Z`).
4. **Banco local = produção** (readme do repo) — seed e E2E ainda mexem no banco apontado pelo túnel. Risco alto para clientes de verdade.
5. **E-mail de novo agendamento** só dispara depois do `create` válido.
6. **NO_SHOW e CANCELLED** continuam liberando o slot. Não há antecedência mínima para cancelar.

---

## O que os testes cobrem

### Deve passar (`npm run test:e2e`)

- Login, wizard, só slot livre, resumo e lista em `/appointments`.
- Horário ocupado some da grade para o segundo cliente.
- `401` sem token em disponibilidade e `/book`.
- `409` no mesmo profissional, no mesmo intervalo.
- Cliente **pode** marcar o mesmo horário com profissionais diferentes.
- Cancelar libera o slot.
- Profissional não vinculado ao serviço → `400`.
- `clientId` forjado é ignorado.
- `price` forjado não altera o valor.
- Notas > 500 caracteres → `400`.
- USER não usa `POST /api/appointments` (admin).
- USER não cancela agenda alheia nem muda status administrativo.
- Calendário com dia passado desabilitado; domingo/Natal fechados no date picker (se o seed estiver lá).

### Regressão das correções (`npm run test:e2e:gaps`)

- `/book` em domingo, no passado, às 23:00, às 10:07, estourando o fechamento → `400`.
- Dois POSTs simultâneos no mesmo slot → um `201` e um `409`.
- `GET /api/appointments` e `GET /:id` alheio → `403`.
- `GET /api/auth/clients` → `403`.
- `includeInactive` como USER → `403`.
- Sem e-mail/telefone na listagem de profissionais para o cliente.
- Profissional acessando `/book` é redirecionado.

---

## Ordem em que as correções foram feitas

1. Fechar IDOR de leitura (`/appointments`, `/appointments/:id`, `/auth/clients`).
2. Validar no `create` a mesma regra da disponibilidade.
3. Trava transacional + exclusion constraint contra double-booking do profissional.
4. Cancelamento com as mesmas regras da UI. Overlap do **cliente** permanece permitido.
5. Recarregar `user.active`/`role` no middleware; enxugar PII do profissional no fluxo do cliente.
6. Rate limit, CORS restrito à origem do front, `JWT_SECRET` obrigatório.
