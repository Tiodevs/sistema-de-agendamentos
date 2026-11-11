// Testes de fumaça de um ambiente publicado: a API no Railway e, com --web, o web na Vercel.
//
// Uso:
//   node .github/scripts/smoke.mjs --api https://api-production-ac23.up.railway.app \
//     [--commit <sha>] [--web https://agendamento.mefelipe.com.br]
//
// Com --commit, a fumaça espera até 10 minutos o /api/health devolver esse commit antes de
// testar. O Railway mantém a versão anterior no ar quando um deploy falha (inclusive quando o
// pré-deploy das migrations para), e sem essa espera a fumaça aprovaria a versão antiga.
// Com --web, confere também o web: as páginas, o JavaScript chamando esta API e o CORS da API
// aceitando a origem do web.
// Se a proteção de deployments da Vercel cobrir o host do web, VERCEL_AUTOMATION_BYPASS_SECRET no
// ambiente vai no cabeçalho x-vercel-protection-bypass dos pedidos ao web.
//
// Quem usa: os dois jobs do deploy.yml, depois de cada publicação, e quem opera no fim de um
// rollback (docs/rollback.md). Só usa o fetch do Node, sem dependências. Sai com 1 e a lista do
// que falhou; argumentos inválidos saem com 2, antes de qualquer pedido.
import { parseArgs } from 'node:util';

const USAGE =
  'Uso: node .github/scripts/smoke.mjs --api <origem da API> [--commit <sha>] [--web <origem do web>]';

function invalid(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(2);
}

let args;
try {
  args = parseArgs({
    options: {
      api: { type: 'string' },
      web: { type: 'string' },
      commit: { type: 'string' },
    },
    strict: true,
  }).values;
} catch (error) {
  invalid(error instanceof Error ? error.message : String(error));
}

// As origens chegam sem a barra do fim, para os caminhos abaixo serem concatenados direto.
const origin = (value) => (value ?? '').trim().replace(/\/+$/, '');
const api = origin(args.api);
const web = origin(args.web);
const expectedBuild = (args.commit ?? '').trim();

if (!/^https?:\/\/[^/]+$/.test(api)) {
  invalid(
    'Informe a origem da API, sem caminho, por exemplo https://api-production-ac23.up.railway.app',
  );
}
if (web && !/^https?:\/\/[^/]+$/.test(web)) {
  invalid(
    'A origem do web precisa ser http(s) e sem caminho, por exemplo https://agendamento.mefelipe.com.br',
  );
}
if (expectedBuild && !/^[0-9A-Za-z]{1,64}$/.test(expectedBuild)) {
  invalid('O commit precisa ser alfanumérico, como o SHA do git.');
}

// Prazo de cada pedido.
const requestTimeoutMs = 30_000;
const bypass = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '').trim();
// As mensagens das verificações que falharam, contadas no resumo do fim.
const failures = [];

/** Registra uma verificação: `ok` na saída padrão, ou `FALHOU` no erro padrão e em `failures`. */
function check(condition, message) {
  if (condition) {
    console.log(`ok      ${message}`);
  } else {
    failures.push(message);
    console.error(`FALHOU  ${message}`);
  }
}

/** Um pedido com prazo, sem seguir redirecionamento: um 3xx não pode chegar como o 200 do destino. */
function request(url, init = {}) {
  return fetch(url, { redirect: 'manual', ...init, signal: AbortSignal.timeout(requestTimeoutMs) });
}

/** Um pedido ao web, com o cabeçalho da proteção da Vercel quando há o segredo. */
function webRequest(path) {
  const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : {};
  return request(`${web}${path}`, { headers });
}

/** A resposta, ou `null` com o erro no log quando o pedido nem chega a ter resposta (DNS, TLS, prazo). */
async function attempt(label, pending) {
  try {
    return await pending;
  } catch (error) {
    console.error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** O corpo como JSON, ou `null` quando ele não é JSON, como uma página de erro do Railway. */
async function json(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Espera um 200 que passe em `accept`. Devolve a última resposta, ou `null` se nenhuma chegou. */
async function waitFor(url, { attempts, delayMs, accept = async () => true }) {
  let last = null;
  for (let tries = 1; tries <= attempts; tries += 1) {
    const response = await attempt(`GET ${url}`, request(url));
    if (response) {
      last = response;
      if (response.status === 200 && (await accept(response.clone()))) return response;
    }
    if (tries < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return last;
}

// 1. A API no ar, com o commit esperado quando ele é informado. Com o commit, até 60 tentativas a
// cada 10 s: o Railway constrói, roda o pré-deploy e espera o health check da versão nova. Sem
// ele, 2 minutos bastam.
const health = await waitFor(`${api}/api/health`, {
  attempts: expectedBuild ? 60 : 20,
  delayMs: expectedBuild ? 10_000 : 6_000,
  accept: async (response) => !expectedBuild || (await json(response))?.build === expectedBuild,
});
check(health?.status === 200, 'GET /api/health responde 200');
if (health) {
  if (expectedBuild) {
    const body = await json(health);
    check(
      body?.build === expectedBuild,
      `a API no ar é a do commit ${expectedBuild} (respondeu ${body?.build ?? 'sem commit'})`,
    );
  }
  // Todo pedido devolve o id no cabeçalho (request-id.middleware.ts), e os cabeçalhos do helmet.
  check(Boolean(health.headers.get('x-request-id')), '/api/health devolve X-Request-Id');
  check(
    health.headers.get('x-content-type-options') === 'nosniff',
    'a API manda X-Content-Type-Options: nosniff',
  );
  check(
    (health.headers.get('strict-transport-security') ?? '').includes('max-age='),
    'a API manda Strict-Transport-Security',
  );
  check(!health.headers.has('x-powered-by'), 'a API não anuncia o Express (sem X-Powered-By)');
}

// 2. A API alcança o banco do ambiente: /api/health/ready faz um SELECT 1 no Postgres.
const ready = await waitFor(`${api}/api/health/ready`, { attempts: 10, delayMs: 6_000 });
check(ready?.status === 200, 'GET /api/health/ready responde 200 (a API alcança o banco)');

// 3. Uma rota autenticada recusa o pedido sem token.
const me = await attempt('GET /api/auth/me', request(`${api}/api/auth/me`));
check(
  me?.status === 401,
  `GET /api/auth/me sem token responde 401 (respondeu ${me?.status ?? 'nada'})`,
);

// 4. O Swagger fica fechado: NODE_ENV=production e SWAGGER_ENABLED sem valor.
const docs = await attempt('GET /api/docs.json', request(`${api}/api/docs.json`));
check(
  docs?.status === 404,
  `o Swagger fica fechado: GET /api/docs.json responde 404 (respondeu ${docs?.status ?? 'nada'})`,
);

if (web) {
  // 5. As páginas do web.
  const home = await attempt('GET / no web', webRequest('/'));
  check(
    home?.status === 200 && (home.headers.get('content-type') ?? '').includes('text/html'),
    `GET / no web devolve a página (respondeu ${home?.status ?? 'nada'})`,
  );
  const login = await attempt('GET /login no web', webRequest('/login'));
  const loginHtml = login?.status === 200 ? await login.text() : '';
  check(
    login?.status === 200,
    `GET /login no web responde 200 (respondeu ${login?.status ?? 'nada'})`,
  );

  // 6. O JavaScript do web chama esta API. O NEXT_PUBLIC_API_URL entra no bundle durante o build;
  // se o build pegou a URL de outro ambiente, o web publicado chama a API errada sem erro nenhum.
  const scripts = [...new Set(loginHtml.match(/\/_next\/static\/[^"'\s]+?\.js/g) ?? [])].slice(
    0,
    80,
  );
  let bundleHasApi = false;
  for (const script of scripts) {
    const response = await attempt(`GET ${script}`, webRequest(script));
    if (response?.status === 200 && (await response.text()).includes(api)) {
      bundleHasApi = true;
      break;
    }
  }
  check(
    bundleHasApi,
    `o JavaScript do /login chama ${api} (NEXT_PUBLIC_API_URL do build; ${scripts.length} arquivo(s) lido(s))`,
  );

  // 7. O CORS da API aceita a origem do web, e só ela. Sem isso, o navegador bloqueia o login.
  const preflight = (from) =>
    request(`${api}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: from,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
  const allowed = await attempt('OPTIONS /api/auth/login', preflight(web));
  check(
    allowed?.headers.get('access-control-allow-origin') === web,
    `o CORS da API aceita ${web} (APP_URL ou CORS_ORIGINS do ambiente)`,
  );
  const foreign = await attempt(
    'OPTIONS /api/auth/login',
    preflight('https://origem-desconhecida.example'),
  );
  check(
    foreign !== null && !foreign.headers.get('access-control-allow-origin'),
    'o CORS da API recusa uma origem desconhecida',
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log(`\nFumaça verde em ${web ? `${api} e ${web}` : api}.`);
