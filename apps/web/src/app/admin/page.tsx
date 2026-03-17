'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Users, CalendarDays, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const stats = [
    {
      title: 'Produtos Ativos',
      value: '—',
      description: 'Serviços cadastrados',
      icon: Package,
    },
    {
      title: 'Usuários',
      value: '—',
      description: 'Contas registradas',
      icon: Users,
    },
    {
      title: 'Agendamentos',
      value: '—',
      description: 'Este mês',
      icon: CalendarDays,
    },
    {
      title: 'Receita',
      value: '—',
      description: 'Este mês',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <CardDescription>{stat.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Painel Administrativo</CardTitle>
          <CardDescription>
            Gerencie seus produtos, usuários e agendamentos a partir do menu lateral.
            Em breve, este dashboard será atualizado com estatísticas em tempo real.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
