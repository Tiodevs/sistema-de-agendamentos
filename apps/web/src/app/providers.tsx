'use client';

import { Suspense, type ReactNode } from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AdminThemeProvider } from '@/components/admin/admin-theme';
import { MotionProvider } from '@/components/motion/motion-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
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
  );
}
