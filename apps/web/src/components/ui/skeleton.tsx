import * as React from 'react';

import { cn } from '@/lib/utils';

/** Bloco cinza que segura o lugar do conteúdo enquanto ele carrega (UX-10). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-xl bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
