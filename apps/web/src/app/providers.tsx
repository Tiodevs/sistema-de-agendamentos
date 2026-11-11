'use client';

import { Suspense, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/use-auth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AdminThemeProvider } from '@/components/admin/admin-theme';
import { MotionProvider } from '@/components/motion/motion-provider';

/**
 * TanStack Query (ARQ-08): cache e cancelamento das buscas. Erro 4xx não é tentado de novo
 * (a resposta não muda); falha de rede ou 5xx ganha uma nova tentativa.
 */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { statusCode?: number } | null)?.statusCode ?? 0;
          if (status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // Um cliente por montagem do app (não um global): no servidor, cada requisição tem o seu.
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminThemeProvider>
          <MotionProvider>
            <TooltipProvider>
              <Suspense fallback={null}>{children}</Suspense>
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </MotionProvider>
        </AdminThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
