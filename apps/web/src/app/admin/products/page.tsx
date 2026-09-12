'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getProducts,
  createProduct,
  updateProduct,
  toggleProduct,
  deleteProduct,
  type Product,
  type ProductPayload,
} from '@/lib/api';
import { formatCurrency, formatDuration } from '@/lib/format';
import { accentForProduct, iconForProduct } from '@/lib/admin-accents';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ProductDialog } from '@/components/admin/product-dialog';
import { DeleteProductDialog } from '@/components/admin/delete-product-dialog';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await getProducts(true);
      if (response.data?.products) {
        setProducts(response.data.products);
      }
    } catch {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      Boolean(product.description?.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;
    if (visibility === 'ACTIVE') return product.active;
    if (visibility === 'INACTIVE') return !product.active;
    return true;
  });

  async function handleCreate(data: ProductPayload) {
    try {
      await createProduct(data);
      toast.success('Produto cadastrado com sucesso!');
      await fetchProducts();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao cadastrar produto');
      throw err;
    }
  }

  async function handleUpdate(data: ProductPayload) {
    if (!editingProduct) return;
    try {
      await updateProduct(editingProduct.id, data);
      toast.success('Produto atualizado com sucesso!');
      await fetchProducts();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao atualizar produto');
      throw err;
    }
  }

  async function handleToggle(product: Product) {
    try {
      await toggleProduct(product.id);
      toast.success(product.active ? 'Produto desativado' : 'Produto ativado');
      await fetchProducts();
    } catch {
      toast.error('Erro ao alterar status');
    }
  }

  async function handleDelete() {
    if (!deletingProduct) return;
    try {
      await deleteProduct(deletingProduct.id);
      toast.success('Produto excluído com sucesso!');
      await fetchProducts();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao excluir produto');
      throw err;
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Produtos"
        description="Serviços oferecidos pela agenda."
        action={
          <Button
            className="rounded-full"
            onClick={() => {
              setEditingProduct(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Novo Produto
          </Button>
        }
      />

      <section className="admin-surface p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto text-sm">
            {(
              [
                ['ALL', 'Todos'],
                ['ACTIVE', 'Ativos'],
                ['INACTIVE', 'Inativos'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setVisibility(value)}
                className={cn(
                  'rounded-full px-3 py-1.5 font-medium transition-colors',
                  visibility === value
                    ? 'bg-[var(--admin-card-muted)] text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full pl-10"
            />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="mb-4 size-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">Nenhum produto encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? 'Tente alterar os filtros de busca.'
                : 'Cadastre o primeiro serviço para começar.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const accent = accentForProduct(product.name);
              const Icon = iconForProduct(product.name);
              return (
                <article
                  key={product.id}
                  className={cn(
                    'relative rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4',
                    !product.active && 'opacity-60',
                  )}
                >
                  <div className="mb-5 flex items-start justify-between">
                    <span className="inline-flex items-center rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {formatDuration(product.duration)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 rounded-2xl">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-2xl">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingProduct(product);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(product)}>
                          {product.active ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeletingProduct(product);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="size-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div
                    className={cn(
                      'mb-5 flex size-16 items-center justify-center rounded-3xl',
                      accent.bg,
                    )}
                  >
                    <Icon className={cn('size-8', accent.fg)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {product.active ? 'Serviço' : 'Inativo'}
                  </p>
                  <h2 className="mt-1 font-semibold leading-snug">{product.name}</h2>
                  <p className="mt-2 text-sm font-medium">{formatCurrency(product.price)}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSubmit={editingProduct ? handleUpdate : handleCreate}
      />
      <DeleteProductDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        productName={deletingProduct?.name || ''}
        onConfirm={handleDelete}
      />
    </div>
  );
}
