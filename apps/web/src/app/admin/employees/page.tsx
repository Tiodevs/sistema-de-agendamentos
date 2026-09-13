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
import { getInitials } from '@/lib/format';
import { accentForId } from '@/lib/admin-accents';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { EmployeeDialog } from '@/components/admin/employee-dialog';
import { DeleteEmployeeDialog } from '@/components/admin/delete-employee-dialog';
import { AssignProductsDialog } from '@/components/admin/assign-products-dialog';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Users, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [empRes, prodRes] = await Promise.all([getEmployees(true), getProducts(false)]);
      if (empRes.data?.employees) setEmployees(empRes.data.employees);
      if (prodRes.data?.products) setProducts(prodRes.data.products);
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(search.toLowerCase()) ||
      employee.email.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (visibility === 'ACTIVE') return employee.active;
    if (visibility === 'INACTIVE') return !employee.active;
    return true;
  });

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

  if (loading) return null;

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Funcionários"
          description="Profissionais e os serviços que cada um realiza."
          action={
            <Button
              className="rounded-full"
              onClick={() => {
                setEditingEmployee(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Novo Funcionário
            </Button>
          }
        />
      </div>

      <section data-motion="enter" className="admin-surface p-4 sm:p-5">
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
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full pl-10"
            />
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="mb-4 size-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold">Nenhum funcionário encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? 'Tente alterar os filtros de busca.'
                : 'Cadastre o primeiro profissional para começar.'}
            </p>
          </div>
        ) : (
          <StaggerIn className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((employee) => {
              const accent = accentForId(employee.id);
              return (
                <article
                  key={employee.id}
                  data-motion="lift"
                  className={cn(
                    'relative rounded-[1.35rem] bg-[var(--admin-card-muted)] p-4',
                    !employee.active && 'opacity-60',
                  )}
                >
                  <div className="mb-5 flex items-start justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-chip)] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      <Package className="size-3" />
                      {employee.products.length} serviços
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
                            setEditingEmployee(employee);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setAssigningEmployee(employee);
                            setAssignDialogOpen(true);
                          }}
                        >
                          <Package className="size-4" />
                          Atribuir produtos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggle(employee)}>
                          {employee.active ? 'Desativar' : 'Ativar'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setDeletingEmployee(employee);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="size-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Avatar className="mb-5 size-16">
                    <AvatarFallback className={cn('text-lg', accent.bg, accent.fg)}>
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs text-muted-foreground">
                    {employee.active ? 'Profissional' : 'Inativo'}
                  </p>
                  <h2 className="mt-1 font-semibold">{employee.name}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{employee.email}</p>
                </article>
              );
            })}
          </StaggerIn>
        )}
      </section>

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
    </StaggerIn>
  );
}
