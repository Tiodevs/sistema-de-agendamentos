export function readAuthLinkToken(searchToken?: string | null) {
  if (typeof window === 'undefined') return searchToken?.trim() || '';

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const fromHash = new URLSearchParams(hash).get('token')?.trim() || '';
  return fromHash || searchToken?.trim() || '';
}

export function stripAuthLinkTokenFromUrl(pathname: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  url.hash = '';
  const next = `${pathname}${url.search}`;
  window.history.replaceState(window.history.state, '', next);
}
