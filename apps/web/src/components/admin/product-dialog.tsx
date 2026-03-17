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
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { Product, ProductPayload } from '@/lib/api';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSubmit: (data: ProductPayload) => Promise<void>;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSubmit,
}: ProductDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!product;

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setPrice(product.price.toFixed(2).replace('.', ','));
      setDuration(String(product.duration));
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setDuration('');
    }
    setErrors({});
  }, [product, open]);

  function parseBRLPrice(value: string): number {
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleaned);
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Nome é obrigatório';
    if (name.trim().length > 0 && name.trim().length < 2)
      newErrors.name = 'Nome deve ter pelo menos 2 caracteres';

    const parsedPrice = parseBRLPrice(price);
    if (!price.trim()) newErrors.price = 'Preço é obrigatório';
    else if (isNaN(parsedPrice) || parsedPrice <= 0)
      newErrors.price = 'Preço deve ser maior que zero';

    const parsedDuration = parseInt(duration, 10);
    if (!duration.trim()) newErrors.duration = 'Duração é obrigatória';
    else if (isNaN(parsedDuration) || parsedDuration < 5)
      newErrors.duration = 'Duração mínima é 5 minutos';
    else if (parsedDuration > 480)
      newErrors.duration = 'Duração máxima é 480 minutos (8h)';

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
        description: description.trim() || undefined,
        price: parseBRLPrice(price),
        duration: parseInt(duration, 10),
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
          <DialogTitle>
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Altere as informações do produto abaixo.'
              : 'Preencha os dados para cadastrar um novo produto.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="product-name">Nome</Label>
            <Input
              id="product-name"
              placeholder="Ex: Corte de cabelo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="product-description">
              Descrição <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="product-description"
              placeholder="Descreva o serviço..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Price + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-price">Preço (R$)</Label>
              <Input
                id="product-price"
                placeholder="50,00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={loading}
              />
              {errors.price && (
                <p className="text-xs text-destructive">{errors.price}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-duration">Duração (min)</Label>
              <Input
                id="product-duration"
                type="number"
                min={5}
                max={480}
                placeholder="30"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={loading}
              />
              {errors.duration && (
                <p className="text-xs text-destructive">{errors.duration}</p>
              )}
            </div>
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
