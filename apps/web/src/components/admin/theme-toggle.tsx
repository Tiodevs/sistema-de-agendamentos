'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminTheme } from '@/components/admin/admin-theme';

export function AdminThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, mounted } = useAdminTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className ?? 'rounded-2xl'}
          onClick={toggleTheme}
          disabled={!mounted}
          aria-label={label}
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
