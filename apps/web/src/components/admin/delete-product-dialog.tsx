'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Archive } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/lib/api';
import { countAppointments } from '@/lib/affected-appointments';

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onConfirm: () => Promise<void>;
  /** Com histórico, o caminho é desativar (DOM-04). */
  onDeactivate: () => void;
}

export function DeleteProductDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
  onDeactivate,
}: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const name = product?.name ?? '';
  const history = product?.appointmentCount ?? 0;

  async function handleDelete() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Errors handled by parent
    } finally {
      setLoading(false);
    }
  }

  if (history > 0) {
    // DOM-04: excluir apagaria o histórico; o serviço fica e sai do catálogo desativado.
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <Archive className="size-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle>Este serviço tem histórico</DialogTitle>
                <DialogDescription>
                  Para não apagar atendimentos, ele não é excluído.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">&ldquo;{name}&rdquo;</strong> aparece em{' '}
            {countAppointments(history)}. Excluir tiraria esses registros dos relatórios e da ficha
            dos clientes.{' '}
            {product?.active
              ? 'Desative: ele sai do catálogo e do agendamento online, e o histórico continua guardado.'
              : 'Ele já está desativado: não aparece mais para agendar, e o histórico continua guardado.'}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {product?.active ? 'Cancelar' : 'Fechar'}
            </Button>
            {product?.active ? <Button onClick={onDeactivate}>Desativar</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Excluir produto</DialogTitle>
              <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Tem certeza que deseja excluir o produto{' '}
          <strong className="text-foreground">&ldquo;{name}&rdquo;</strong>? Ele nunca foi agendado.
          Os profissionais deixam de oferecê-lo.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
