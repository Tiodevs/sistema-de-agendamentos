import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function RegisterCta({
  children = 'Criar conta',
  className,
  showIcon = true,
}: {
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <Button asChild className={cn('rounded-full', className)}>
      <Link href="/register">
        {showIcon ? <UserPlus /> : null}
        {children}
      </Link>
    </Button>
  );
}
