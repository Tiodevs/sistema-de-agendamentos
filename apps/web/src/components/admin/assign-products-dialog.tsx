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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Loader2, Package, Clock } from 'lucide-react';
import { formatCurrency, formatDuration } from '@/lib/format';
import type { Employee, Product } from '@/lib/api';

interface AssignProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  allProducts: Product[];
  onSubmit: (productIds: string[]) => Promise<void>;
}

export function AssignProductsDialog({
  open,
  onOpenChange,
  employee,
  allProducts,
  onSubmit,
}: AssignProductsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      const currentIds = new Set(employee.products.map((ep) => ep.product.id));
      setSelectedIds(currentIds);
    } else {
      setSelectedIds(new Set());
    }
  }, [employee, open]);

  function toggleProduct(productId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await onSubmit(Array.from(selectedIds));
      onOpenChange(false);
    } catch {
      // Errors handled by parent
    } finally {
      setLoading(false);
    }
  }

  const activeProducts = allProducts.filter((p) => p.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Atribuir Produtos</DialogTitle>
          <DialogDescription>
            Selecione os produtos que{' '}
            <strong className="text-foreground">{employee?.name}</strong> pode
            atender.
          </DialogDescription>
        </DialogHeader>

        {activeProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Package className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhum produto ativo cadastrado.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {activeProducts.map((product) => {
                const isSelected = selectedIds.has(product.id);
                return (
                  <label
                    key={product.id}
                    htmlFor={`product-${product.id}`}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <Switch
                      id={`product-${product.id}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleProduct(product.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{product.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatCurrency(product.price)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {formatDuration(product.duration)}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Badge variant="secondary">
            {selectedIds.size} {selectedIds.size === 1 ? 'produto selecionado' : 'produtos selecionados'}
          </Badge>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar atribuições
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
