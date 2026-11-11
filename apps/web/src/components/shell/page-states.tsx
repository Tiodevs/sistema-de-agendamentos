import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * UX-10: estados de tela compartilhados.
 *
 * Carregando: antes as páginas devolviam `null` (tela vazia, e o leitor de tela não ouvia nada).
 * Erro: falha da API tem tela própria, com "Tentar de novo"; não se confunde com lista vazia.
 */
export function LoadingState({
  label = 'Carregando…',
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div className="space-y-2 py-1">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

/** Cabeçalho + lista de linhas (agenda, clientes, meus horários). */
export function ListSkeleton({ rows = 5, label }: { rows?: number; label?: string }) {
  return (
    <LoadingState label={label} className="space-y-5">
      <SkeletonHeader />
      <div className="admin-surface p-4 sm:p-5">
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
      <div className="admin-surface divide-y divide-border overflow-hidden">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-4 sm:px-5">
            <Skeleton className="size-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="hidden h-4 w-16 sm:block" />
          </div>
        ))}
      </div>
    </LoadingState>
  );
}

/** Cabeçalho + grade de cartões (serviços, equipe). */
export function CardGridSkeleton({ cards = 6, label }: { cards?: number; label?: string }) {
  return (
    <LoadingState label={label} className="space-y-5">
      <SkeletonHeader />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="admin-surface space-y-4 p-5">
            <Skeleton className="size-14 rounded-2xl" />
            <Skeleton className="h-4 w-36 max-w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </LoadingState>
  );
}

/** Painel do admin e do profissional: filtros, quatro KPIs, gráfico e coluna lateral. */
export function DashboardSkeleton({ label }: { label?: string }) {
  return (
    <LoadingState label={label} className="space-y-4">
      <div className="admin-surface p-4 sm:p-5">
        <Skeleton className="h-8 w-64 max-w-full rounded-full" />
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="admin-surface space-y-3 p-4 sm:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="admin-surface space-y-4 p-4 sm:p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="admin-surface space-y-4 p-5">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </LoadingState>
  );
}

/** Formulário ou ficha (perfil, expediente, ficha do cliente). */
export function FormSkeleton({ label }: { label?: string }) {
  return (
    <LoadingState label={label} className="space-y-5">
      <SkeletonHeader />
      <div className="admin-surface space-y-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
      <div className="admin-surface space-y-4 p-4 sm:p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-1/2" />
      </div>
    </LoadingState>
  );
}

export function LoadError({
  title,
  description = 'Confira a conexão e tente de novo.',
  onRetry,
  className,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <section
      role="alert"
      className={cn(
        'admin-surface flex flex-col items-center justify-center gap-2 px-6 py-16 text-center',
        className,
      )}
    >
      <AlertCircle className="mb-2 size-10 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-3 rounded-full" onClick={onRetry}>
          Tentar de novo
        </Button>
      ) : null}
    </section>
  );
}
