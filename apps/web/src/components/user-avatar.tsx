'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';

export function UserAvatar({
  name,
  src,
  className,
  fallbackClassName,
}: {
  name: string;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const imageSrc = src?.trim() || undefined;

  return (
    <Avatar key={imageSrc ?? 'fallback'} className={className}>
      {imageSrc ? <AvatarImage src={imageSrc} alt={name} referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className={cn(fallbackClassName)}>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
