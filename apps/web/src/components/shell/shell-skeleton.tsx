const block = 'rounded-full bg-[var(--admin-card-muted)]';

/**
 * ARQ-11: casca do painel enquanto a sessão carrega (ou enquanto o redirecionamento acontece),
 * no lugar de uma tela em branco. Mesma moldura do AppShell, sem dados e sem hooks.
 */
export function ShellSkeleton() {
  return (
    <div className="admin-theme admin-frame p-3 sm:p-4 lg:p-5" role="status" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      <div className="flex items-start gap-3 lg:gap-4" aria-hidden="true">
        <div className="admin-rail hidden w-[4.5rem] shrink-0 flex-col items-center gap-2 self-start rounded-[32px] py-5 lg:flex">
          <div className="mb-6 size-11 rounded-2xl bg-white/10" />
          <div className="size-11 rounded-2xl bg-white/5" />
          <div className="size-11 rounded-2xl bg-white/5" />
          <div className="size-11 rounded-2xl bg-white/5" />
          <div className="mt-auto size-10 rounded-full bg-white/10" />
        </div>

        <div className="admin-panel min-h-[calc(100dvh-1.5rem)] min-w-0 flex-1 rounded-[28px] sm:min-h-[calc(100dvh-2rem)] sm:rounded-[32px] lg:min-h-[calc(100dvh-2.5rem)]">
          <div className="motion-safe:animate-pulse">
            <div className="flex items-center justify-between gap-3 px-3 py-4 sm:px-6">
              <div className={`h-5 w-36 ${block}`} />
              <div className="flex items-center gap-2">
                <div className={`size-9 ${block}`} />
                <div className={`size-9 ${block}`} />
                <div className={`h-9 w-20 ${block}`} />
              </div>
            </div>
            <div className="space-y-4 px-3 pb-5 sm:px-6 lg:px-7">
              <div className={`h-8 w-52 max-w-full ${block}`} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="admin-surface h-28" />
                <div className="admin-surface h-28" />
                <div className="admin-surface hidden h-28 sm:block" />
                <div className="admin-surface hidden h-28 sm:block" />
              </div>
              <div className="admin-surface h-64" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
