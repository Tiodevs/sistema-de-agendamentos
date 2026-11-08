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
  sendEmployeeInvite,
  revokeEmployeeAccess,
  apiErrorMessage,
  type Employee,
  type EmployeePayload,
  type Product,
} from '@/lib/api';
import { accentForId } from '@/lib/admin-accents';
import { impactMessage } from '@/lib/affected-appointments';
import { describeAccess, type AccessTone } from '@/lib/employee-access';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { UserAvatar } from '@/components/user-avatar';
import { EmployeeDialog } from '@/components/admin/employee-dialog';
import { DeleteEmployeeDialog } from '@/components/admin/delete-employee-dialog';
import { AssignProductsDialog } from '@/components/admin/assign-products-dialog';
import {
  AffectedAppointmentsDialog,
  useAffectedAppointments,
} from '@/components/admin/affected-appointments-dialog';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Package,
  Mail,
  ShieldCheck,
  ShieldOff,
  Clock3,
  KeyRound,
  Loader2,
  UserX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaggerIn } from '@/components/motion/stagger-in';

const ACCESS_STYLE: Record<AccessTone, string> = {
  ok: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  muted: 'bg-[var(--admin-chip)] text-muted-foreground',
};

const ACCESS_ICON: Record<AccessTone, typeof ShieldCheck> = {
  ok: ShieldCheck,
  pending: Clock3,
  warning: Clock3,
  muted: ShieldOff,
};

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
  const [revokingEmployee, setRevokingEmployee] = useState<Employee | null>(null);
  const [revoking, setRevoking] = useState(false);
  // DOM-02: desativar quem tem horários marcados pede uma decisão sobre eles.
  const affected = useAffectedAppointments();

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
      employee.email?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (visibility === 'ACTIVE') return employee.active;
    if (visibility === 'INACTIVE') return !employee.active;
    return true;
  });

  async function handleCreate(data: EmployeePayload) {
    try {
      const res = await createEmployee(data);
      toast.success(
        res.message || `Profissional cadastrado. Enviamos o convite de acesso para ${data.email}.`,
      );
      await fetchData();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao cadastrar funcionário'));
      throw err;
    }
  }

  async function handleUpdate(data: EmployeePayload) {
    if (!editingEmployee) return;
    const previous = editingEmployee;
    try {
      await updateEmployee(previous.id, data);
      // A API reenvia o convite em aberto quando o e-mail muda (o antigo deixa de valer).
      const resent =
        data.email !== previous.email && previous.active && previous.access?.status === 'pending';
      toast.success(
        resent
          ? `Funcionário atualizado. Enviamos um novo convite para ${data.email}.`
          : 'Funcionário atualizado com sucesso!',
      );
      await fetchData();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao atualizar funcionário'));
      throw err;
    }
  }

  async function handleToggle(employee: Employee) {
    const deactivating = employee.active;
    try {
      await affected.run(`Desativar ${employee.name}`, async (decision) => {
        const res = await toggleEmployee(employee.id, decision);
        toast.success(
          deactivating
            ? impactMessage(
                'Profissional desativado.',
                res.data?.impact,
                'com o profissional desativado',
              )
            : 'Profissional ativado.',
        );
        await fetchData();
      });
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao alterar status'));
    }
  }

  async function handleDelete() {
    if (!deletingEmployee) return;
    try {
      await deleteEmployee(deletingEmployee.id);
      toast.success('Funcionário excluído com sucesso!');
      await fetchData();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao excluir funcionário'));
      // Ex.: alguém agendou no meio do caminho (409 HAS_APPOINTMENTS): a lista atualizada faz o
      // diálogo oferecer "Desativar".
      await fetchData();
      throw err;
    }
  }

  async function handleSendInvite(employee: Employee) {
    try {
      const res = await sendEmployeeInvite(employee.id);
      toast.success(res.message || `Convite enviado para ${employee.email}.`);
      await fetchData();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Não foi possível enviar o convite'));
    }
  }

  async function handleRevoke() {
    if (!revokingEmployee) return;
    const linked = revokingEmployee.access?.status === 'linked';
    setRevoking(true);
    try {
      await revokeEmployeeAccess(revokingEmployee.id);
      toast.success(linked ? 'Acesso ao painel removido.' : 'Convite cancelado.');
      setRevokingEmployee(null);
      await fetchData();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Não foi possível remover o acesso'));
    } finally {
      setRevoking(false);
    }
  }

  async function handleAssignProducts(productIds: string[]) {
    if (!assigningEmployee) return;
    try {
      await assignEmployeeProducts(assigningEmployee.id, productIds);
      toast.success('Produtos atribuídos com sucesso!');
      await fetchData();
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erro ao atribuir produtos'));
      throw err;
    }
  }

  // Quando a lista recarrega, o diálogo de exclusão passa a ver o registro atualizado.
  const deletingCurrent =
    employees.find((employee) => employee.id === deletingEmployee?.id) ?? deletingEmployee;

  if (loading) return null;

  const revokingAccess = revokingEmployee ? describeAccess(revokingEmployee.access) : null;
  const revokingLinked = revokingEmployee?.access?.status === 'linked';

  return (
    <StaggerIn selector="[data-motion='enter']" className="space-y-5">
      <div data-motion="enter">
        <AdminPageHeader
          title="Funcionários"
          description="Profissionais, os serviços de cada um e o acesso ao painel."
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
          <div className="admin-scroll-x flex gap-1 text-sm">
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
              const access = describeAccess(employee.access);
              const AccessIcon = ACCESS_ICON[access.tone];
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-2xl"
                          aria-label={`Ações de ${employee.name}`}
                        >
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
                        {access.inviteLabel && employee.active ? (
                          <DropdownMenuItem onClick={() => handleSendInvite(employee)}>
                            <Mail className="size-4" />
                            {access.inviteLabel}
                          </DropdownMenuItem>
                        ) : null}
                        {access.revokeLabel ? (
                          <DropdownMenuItem onClick={() => setRevokingEmployee(employee)}>
                            <KeyRound className="size-4" />
                            {access.revokeLabel}
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => handleToggle(employee)}>
                          <UserX className="size-4" />
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
                  <UserAvatar
                    name={employee.name}
                    src={employee.avatar}
                    className="mb-5 size-16"
                    fallbackClassName={cn('text-lg', accent.bg, accent.fg)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {employee.active ? 'Profissional' : 'Inativo'}
                  </p>
                  <h2 className="mt-1 font-semibold">{employee.name}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {employee.email || 'Sem e-mail'}
                  </p>
                  <div className="mt-3 flex min-w-0 flex-col gap-1">
                    <span
                      className={cn(
                        'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                        ACCESS_STYLE[access.tone],
                      )}
                    >
                      <AccessIcon className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{access.label}</span>
                    </span>
                    {access.detail ? (
                      <span
                        className="truncate text-[11px] text-muted-foreground"
                        title={access.detail}
                      >
                        {access.tone === 'ok' ? `Conta: ${access.detail}` : access.detail}
                      </span>
                    ) : null}
                  </div>
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
        employee={deletingCurrent}
        onConfirm={handleDelete}
        onDeactivate={() => {
          const target = deletingCurrent;
          setDeleteDialogOpen(false);
          if (target) void handleToggle(target);
        }}
      />
      <AssignProductsDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        employee={assigningEmployee}
        allProducts={products}
        onSubmit={handleAssignProducts}
      />
      <AffectedAppointmentsDialog {...affected.dialogProps} />

      <Dialog
        open={Boolean(revokingEmployee)}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokingEmployee(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-500/10">
              <KeyRound className="size-6 text-amber-400" aria-hidden />
            </div>
            <DialogTitle className="text-center">
              {revokingLinked ? 'Remover o acesso ao painel?' : 'Cancelar o convite?'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {revokingLinked
                ? `${revokingEmployee?.name} deixa de abrir o painel do profissional. A conta ${
                    revokingEmployee?.access?.status === 'linked' && revokingEmployee.access.email
                      ? revokingEmployee.access.email
                      : 'dele'
                  } volta a ser de cliente. A agenda e o histórico continuam.`
                : `O link enviado para ${revokingEmployee?.email ?? 'o profissional'} deixa de funcionar. Você pode mandar outro quando quiser.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full rounded-full"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? <Loader2 className="size-4 animate-spin" /> : null}
              {revokingAccess?.revokeLabel ?? 'Remover acesso'}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setRevokingEmployee(null)}
              disabled={revoking}
            >
              Voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaggerIn>
  );
}
