'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, CalendarDays, Loader2 } from 'lucide-react';

export default function Home() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!isLoading && isAuthenticated && user?.role === 'ADMIN') {
      router.push('/admin');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                <CalendarDays className="size-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Olá, {user.name}! 👋</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-green-400 border-green-500/30">
              {user.role}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Bem-vindo ao sistema de agendamentos. Em breve, novas funcionalidades serão
              adicionadas aqui!
            </p>
          </div>

          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut />
            Sair da conta
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
