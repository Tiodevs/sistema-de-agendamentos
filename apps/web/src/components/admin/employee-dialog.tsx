'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Employee, EmployeePayload } from '@/lib/api';

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (data: EmployeePayload) => Promise<void>;
}

export function EmployeeDialog({ open, onOpenChange, employee, onSubmit }: EmployeeDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!employee;
  const access = employee?.access;
  const emailChanged =
    isEditing && email.trim().toLowerCase() !== (employee?.email ?? '').trim().toLowerCase();

  /** SEC-03: o que o e-mail significa para o acesso ao painel. */
  let emailHint: string;
  if (!isEditing) {
    emailHint =
      'Enviamos um convite para este e-mail. A conta só ganha acesso ao painel quando a pessoa aceitar; se ela já tiver conta com este e-mail, entra com a própria senha.';
  } else if (access?.status === 'linked') {
    emailHint = `O acesso ao painel é da conta ${access.email ?? 'ligada'}. Mudar o e-mail aqui não muda o login dela.`;
  } else if (access?.status === 'pending') {
    emailHint = emailChanged
      ? 'Ao salvar, o convite atual deixa de valer e um novo vai para o e-mail novo.'
      : 'Há um convite em aberto para este e-mail.';
  } else {
    emailHint = 'Para dar acesso ao painel, use "Enviar convite" no menu do profissional.';
  }

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
    }
    setErrors({});
  }, [employee, open]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    else if (name.trim().length < 2) newErrors.name = 'Nome deve ter pelo menos 2 caracteres';

    if (!email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) newErrors.email = 'E-mail inválido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
      });
      onOpenChange(false);
    } catch {
      // Errors handled by parent via toast
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Altere as informações do funcionário abaixo.'
              : 'Preencha os dados do profissional. Nenhuma conta é ligada ao painel até a pessoa aceitar o convite.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee-name">Nome</Label>
            <Input
              id="employee-name"
              placeholder="Ex: João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-email">E-mail</Label>
            <Input
              id="employee-email"
              type="email"
              placeholder="joao@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              aria-describedby="employee-email-hint"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            <p id="employee-email-hint" className="text-xs text-muted-foreground">
              {emailHint}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-phone">
              Telefone <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="employee-phone"
              placeholder="(11) 99999-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
