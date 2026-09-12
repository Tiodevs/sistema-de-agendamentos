'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AdminThemeProvider } from '@/components/admin/admin-theme';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminThemeProvider>
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </AdminThemeProvider>
    </AuthProvider>
  );
}
