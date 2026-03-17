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
import { formatCurrency, formatDuration, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Package,
  Clock,
} from 'lucide-react';
import { ProductDialog } from '@/components/admin/product-dialog';
import { DeleteProductDialog } from '@/components/admin/delete-product-dialog';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await getProducts(showInactive);
      if (response.data?.products) {
        setProducts(response.data.products);
      }
    } catch {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase())),
  );

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
      toast.success(
        product.active ? 'Produto desativado' : 'Produto ativado',
      );
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

  function openCreate() {
    setEditingProduct(null);
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setDialogOpen(true);
  }

  function openDelete(product: Product) {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie os serviços oferecidos pelo seu negócio.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Novo Produto
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
                Mostrar inativos
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 size-12 text-muted-foreground/50" />
            <CardTitle className="mb-1 text-lg">Nenhum produto encontrado</CardTitle>
            <CardDescription>
              {search
                ? 'Tente alterar os filtros de busca.'
                : 'Cadastre seu primeiro produto para começar.'}
            </CardDescription>
            {!search && (
              <Button onClick={openCreate} className="mt-4">
                <Plus className="mr-2 size-4" />
                Cadastrar produto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredProducts.length}{' '}
              {filteredProducts.length === 1 ? 'produto' : 'produtos'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className={!product.active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                      <span className="text-muted-foreground">
                        {product.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(product.price)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span className="text-sm">{formatDuration(product.duration)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.active ? 'default' : 'secondary'}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {formatDate(product.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(product)}>
                            <Pencil className="mr-2 size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(product)}>
                            <Switch
                              checked={product.active}
                              className="mr-2 scale-75"
                              tabIndex={-1}
                            />
                            {product.active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openDelete(product)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
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
