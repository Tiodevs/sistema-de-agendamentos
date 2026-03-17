'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getEmployees,
  getProducts,
  createEmployee,
  updateEmployee,
  toggleEmployee,
  deleteEmployee,
  assignEmployeeProducts,
  type Employee,
  type EmployeePayload,
  type Product,
} from '@/lib/api';
import { formatDate } from '@/lib/format';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Package,
} from 'lucide-react';
import { EmployeeDialog } from '@/components/admin/employee-dialog';
import { DeleteEmployeeDialog } from '@/components/admin/delete-employee-dialog';
import { AssignProductsDialog } from '@/components/admin/assign-products-dialog';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [empRes, prodRes] = await Promise.all([
        getEmployees(showInactive),
        getProducts(false),
      ]);
      if (empRes.data?.employees) setEmployees(empRes.data.employees);
      if (prodRes.data?.products) setProducts(prodRes.data.products);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreate(data: EmployeePayload) {
    try {
      await createEmployee(data);
      toast.success('Funcionário cadastrado com sucesso!');
      await fetchData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao cadastrar funcionário');
      throw err;
    }
  }

  async function handleUpdate(data: EmployeePayload) {
    if (!editingEmployee) return;
    try {
      await updateEmployee(editingEmployee.id, data);
      toast.success('Funcionário atualizado com sucesso!');
      await fetchData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao atualizar funcionário');
      throw err;
    }
  }

  async function handleToggle(employee: Employee) {
    try {
      await toggleEmployee(employee.id);
      toast.success(employee.active ? 'Funcionário desativado' : 'Funcionário ativado');
      await fetchData();
    } catch {
      toast.error('Erro ao alterar status');
    }
  }

  async function handleDelete() {
    if (!deletingEmployee) return;
    try {
      await deleteEmployee(deletingEmployee.id);
      toast.success('Funcionário excluído com sucesso!');
      await fetchData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao excluir funcionário');
      throw err;
    }
  }

  async function handleAssignProducts(productIds: string[]) {
    if (!assigningEmployee) return;
    try {
      await assignEmployeeProducts(assigningEmployee.id, productIds);
      toast.success('Produtos atribuídos com sucesso!');
      await fetchData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Erro ao atribuir produtos');
      throw err;
    }
  }

  function openCreate() {
    setEditingEmployee(null);
    setDialogOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditingEmployee(employee);
    setDialogOpen(true);
  }

  function openDelete(employee: Employee) {
    setDeletingEmployee(employee);
    setDeleteDialogOpen(true);
  }

  function openAssign(employee: Employee) {
    setAssigningEmployee(employee);
    setAssignDialogOpen(true);
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
          <h1 className="text-3xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground">
            Gerencie os profissionais e seus serviços atribuídos.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Novo Funcionário
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive-emp"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <label htmlFor="show-inactive-emp" className="text-sm text-muted-foreground cursor-pointer">
                Mostrar inativos
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-4 size-12 text-muted-foreground/50" />
            <CardTitle className="mb-1 text-lg">Nenhum funcionário encontrado</CardTitle>
            <CardDescription>
              {search
                ? 'Tente alterar os filtros de busca.'
                : 'Cadastre seu primeiro funcionário para começar.'}
            </CardDescription>
            {!search && (
              <Button onClick={openCreate} className="mt-4">
                <Plus className="mr-2 size-4" />
                Cadastrar funcionário
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredEmployees.length}{' '}
              {filteredEmployees.length === 1 ? 'funcionário' : 'funcionários'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden md:table-cell">E-mail</TableHead>
                  <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id} className={!employee.active ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(employee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{employee.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {employee.email}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {employee.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openAssign(employee)}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                        title="Gerenciar produtos"
                      >
                        <Package className="size-3.5 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">
                          {employee.products.length}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.active ? 'default' : 'secondary'}>
                        {employee.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {formatDate(employee.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(employee)}>
                            <Pencil className="mr-2 size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAssign(employee)}>
                            <Package className="mr-2 size-4" />
                            Atribuir produtos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(employee)}>
                            <Switch
                              checked={employee.active}
                              className="mr-2 scale-75"
                              tabIndex={-1}
                            />
                            {employee.active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openDelete(employee)}
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
      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editingEmployee}
        onSubmit={editingEmployee ? handleUpdate : handleCreate}
      />

      <DeleteEmployeeDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        employeeName={deletingEmployee?.name || ''}
        onConfirm={handleDelete}
      />

      <AssignProductsDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        employee={assigningEmployee}
        allProducts={products}
        onSubmit={handleAssignProducts}
      />
    </div>
  );
}
