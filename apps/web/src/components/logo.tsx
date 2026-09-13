'use client';

import { cn } from '@/lib/utils';
import { LeemiaMark } from '@/components/brand/leemia-mark';

export const BRAND_NAME = 'Leemia';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return <LeemiaMark title={BRAND_NAME} size={size} className={className} />;
}

interface LogoWithTextProps {
  className?: string;
  logoSize?: number;
  textClassName?: string;
}

export function LogoWithText({ className, logoSize = 32, textClassName }: LogoWithTextProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LeemiaMark size={logoSize} />
      <span className={cn('text-lg font-bold', textClassName)}>{BRAND_NAME}</span>
    </div>
  );
}
