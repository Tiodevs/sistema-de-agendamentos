// ARQ-09: prazo de cada chamada à API, somado ao `signal` de quem chamou.

export const DEFAULT_TIMEOUT_MS = 15_000;
/** Upload (FormData) sobe arquivo em rede de celular: prazo maior. */
export const UPLOAD_TIMEOUT_MS = 60_000;

export interface RequestSignal {
  signal: AbortSignal;
  /** O prazo estourou (e não foi quem chamou que cancelou). */
  timedOut: () => boolean;
  /** Solta o timer e o listener do fallback; chame quando a requisição terminar. */
  dispose: () => void;
}

function supportsNativeSignals() {
  return (
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function' &&
    typeof AbortSignal.any === 'function'
  );
}

export function createRequestSignal(
  caller: AbortSignal | null | undefined,
  timeoutMs: number,
  useNative = supportsNativeSignals(),
): RequestSignal {
  if (useNative) {
    const timeout = AbortSignal.timeout(timeoutMs);
    return {
      signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
      timedOut: () => timeout.aborted && !caller?.aborted,
      dispose: () => {},
    };
  }

  // Navegador sem `AbortSignal.any`/`timeout` (Safari < 17.4): mesmo efeito com um controller.
  const controller = new AbortController();
  let expired = false;
  const onCallerAbort = () => controller.abort(caller?.reason);
  const timer = setTimeout(() => {
    expired = true;
    controller.abort();
  }, timeoutMs);

  if (caller?.aborted) onCallerAbort();
  else caller?.addEventListener('abort', onCallerAbort, { once: true });

  return {
    signal: controller.signal,
    timedOut: () => expired && !caller?.aborted,
    dispose: () => {
      clearTimeout(timer);
      caller?.removeEventListener('abort', onCallerAbort);
    },
  };
}
