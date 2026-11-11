// UX-08: destino do `?next=` de login e cadastro. Só vale caminho relativo deste site: o valor
// vem da URL, então qualquer coisa que o navegador possa ler como outro endereço é recusada
// (open redirect). Sem `window`: o middleware e os testes usam o mesmo código.

/** Origem fictícia só para o `URL` resolver o caminho; nunca sai daqui. */
const BASE_ORIGIN = 'http://next.invalid';
const MAX_LENGTH = 512;
/** Barra invertida vira `/` no navegador; tab e quebra de linha são descartados por ele. */
// Os caracteres de controle estão aqui de propósito: é exatamente o que este filtro recusa.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\\\u0000-\u001f\u007f]/;

/** Devolve o caminho normalizado (com query e hash) ou `null` quando não é seguro seguir. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LENGTH) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (UNSAFE_CHARS.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== BASE_ORIGIN) return null;

  // `/.//outro.site` normaliza para `//outro.site`: confere de novo depois de resolver.
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

/** Só o caminho, sem query nem hash. */
export function pathnameOf(path: string) {
  const end = path.search(/[?#]/);
  return end === -1 ? path : path.slice(0, end);
}

/** `/login` ou `/register` levando o `next` adiante (os links entre as duas telas o preservam). */
export function withNext(path: string, next: string | null | undefined) {
  const safe = safeNextPath(next);
  return safe ? `${path}?next=${encodeURIComponent(safe)}` : path;
}
