'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  ApiError,
  apiErrorMessage,
  apiFieldErrors,
  createClient,
  getClient,
  getClients,
  type Client,
  type ClientExistsDetails,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 300;
const RESULTS_LIMIT = 20;

function useDebounced(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function contactLine(client: Pick<Client, 'email' | 'phone'>) {
  return client.email || client.phone || 'Sem contato';
}

/**
 * Escolha do cliente no agendamento do admin.
 *
 * UX-09: a busca é feita no servidor (nome, e-mail ou telefone), só entre clientes, então
 * qualquer cliente é encontrado, não só os 50 primeiros da lista.
 * UX-03: quem ligou e ainda não tem conta é cadastrado aqui mesmo, com nome e telefone.
 */
export function ClientPicker({
  selected,
  onSelect,
}: {
  selected: Client | null;
  onSelect: (client: Client | null) => void;
}) {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const term = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);

  const results = useQuery({
    queryKey: ['clients', 'picker', term],
    enabled: !creating,
    staleTime: 15_000,
    queryFn: async ({ signal }) => {
      const res = await getClients(
        { search: term || undefined, role: 'USER', limit: RESULTS_LIMIT },
        { signal },
      );
      return { clients: res.data?.clients ?? [], total: res.data?.pagination?.total ?? 0 };
    },
  });

  if (creating) {
    return (
      <QuickClientForm
        initialName={search.trim()}
        onCancel={() => setCreating(false)}
        onCreated={(client) => {
          setCreating(false);
          setSearch('');
          onSelect(client);
        }}
      />
    );
  }

  const clients = results.data?.clients ?? [];
  const hidden = (results.data?.total ?? 0) - clients.length;

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={searchId}>Cliente</Label>

      {selected ? (
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-[var(--admin-card-muted)] p-2">
          <UserAvatar
            name={selected.name}
            src={selected.avatarUrl}
            className="size-9"
            fallbackClassName="bg-[var(--admin-chip)] text-xs"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">{contactLine(selected)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full"
            aria-label={`Trocar o cliente ${selected.name}`}
            onClick={() => onSelect(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              type="search"
              placeholder="Nome, e-mail ou telefone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9 text-sm"
              autoComplete="off"
            />
          </div>

          <div className="max-h-52 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl bg-[var(--admin-card-muted)] p-1">
            {results.isPending ? (
              <div className="flex items-center justify-center py-6" role="status">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="sr-only">Buscando clientes…</span>
              </div>
            ) : results.isError ? (
              <div className="px-3 py-5 text-center" role="alert">
                <p className="text-sm text-muted-foreground">
                  Não foi possível buscar os clientes.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-full"
                  onClick={() => void results.refetch()}
                >
                  Tentar de novo
                </Button>
              </div>
            ) : clients.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                {term ? `Nenhum cliente encontrado para “${term}”.` : 'Nenhum cliente cadastrado.'}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {clients.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(client)}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-background/60',
                      )}
                    >
                      <UserAvatar
                        name={client.name}
                        src={client.avatarUrl}
                        className="size-7"
                        fallbackClassName="bg-[var(--admin-chip)] text-[10px]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{client.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {contactLine(client)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hidden > 0 ? (
            <p className="text-xs text-muted-foreground">
              Mostrando {clients.length} de {results.data?.total}. Digite mais para refinar.
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-full"
            onClick={() => setCreating(true)}
          >
            <UserPlus className="size-4" />
            Cadastrar cliente novo
          </Button>
        </>
      )}
    </div>
  );
}

function existingClientFrom(error: unknown): ClientExistsDetails | null {
  if (!(error instanceof ApiError) || error.code !== 'CLIENT_EXISTS') return null;
  const details = error.details as Partial<ClientExistsDetails> | undefined;
  return details?.client?.id ? (details as ClientExistsDetails) : null;
}

/** UX-03: "cliente rápido". Nome e um contato bastam; com e-mail, a pessoa recebe o link da senha. */
function QuickClientForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (client: Client) => void;
}) {
  const formId = useId();
  // Se o que foi digitado na busca parece telefone ou e-mail, já cai no campo certo.
  const looksLikePhone = /^[\d\s()+-]{8,}$/.test(initialName);
  const looksLikeEmail = initialName.includes('@');
  const [name, setName] = useState(looksLikePhone || looksLikeEmail ? '' : initialName);
  const [phone, setPhone] = useState(looksLikePhone ? initialName : '');
  const [email, setEmail] = useState(looksLikeEmail ? initialName : '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<ClientExistsDetails | null>(null);
  const [formError, setFormError] = useState('');

  async function pickExisting(details: ClientExistsDetails) {
    setSaving(true);
    try {
      const res = await getClient(details.client.id);
      if (res.data?.client) onCreated(res.data.client);
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Não foi possível abrir o cliente.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    setErrors({});
    setExisting(null);
    setFormError('');

    if (name.trim().length < 2) {
      setErrors({ name: 'Informe o nome do cliente' });
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setErrors({ phone: 'Informe um telefone ou um e-mail' });
      return;
    }

    setSaving(true);
    try {
      const res = await createClient({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      if (res.data?.client) {
        toast.success(res.message || 'Cliente cadastrado.');
        onCreated(res.data.client);
      }
    } catch (error) {
      const found = existingClientFrom(error);
      if (found) {
        setExisting(found);
      } else {
        const fields = apiFieldErrors(error);
        if (fields) setErrors(fields);
        else setFormError(apiErrorMessage(error, 'Não foi possível cadastrar o cliente.'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-3" noValidate>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Cliente novo</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-full px-2 text-xs"
          onClick={onCancel}
        >
          Voltar à busca
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-name`}>Nome</Label>
        <Input
          id={`${formId}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          aria-invalid={Boolean(errors.name)}
          className="h-9 text-sm"
        />
        {errors.name ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-phone`}>Telefone</Label>
        <Input
          id={`${formId}-phone`}
          type="tel"
          inputMode="tel"
          placeholder="(11) 98888-7777"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(errors.phone)}
          className="h-9 text-sm"
        />
        {errors.phone ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.phone}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-email`}>
          E-mail <span className="text-muted-foreground/70">(opcional)</span>
        </Label>
        <Input
          id={`${formId}-email`}
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={`${formId}-email-hint`}
          className="h-9 text-sm"
        />
        {errors.email ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.email}
          </p>
        ) : (
          <p id={`${formId}-email-hint`} className="text-xs text-muted-foreground">
            Com e-mail, o cliente recebe o aviso do horário e um link para criar a senha.
          </p>
        )}
      </div>

      {existing ? (
        <div role="alert" className="rounded-2xl bg-[var(--admin-card-muted)] p-3 text-sm">
          <p>
            Já existe {existing.client.role === 'USER' ? 'um cliente' : 'uma conta da equipe'} com
            este {existing.match === 'email' ? 'e-mail' : 'telefone'}:{' '}
            <span className="font-medium">{existing.client.name}</span>.
          </p>
          {existing.client.role === 'USER' ? (
            <Button
              type="button"
              size="sm"
              className="mt-2 rounded-full"
              disabled={saving}
              onClick={() => void pickExisting(existing)}
            >
              <Check className="size-4" />
              Usar {existing.client.name}
            </Button>
          ) : null}
        </div>
      ) : null}

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="sm" className="w-full rounded-full" disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        Cadastrar e selecionar
      </Button>
    </form>
  );
}
