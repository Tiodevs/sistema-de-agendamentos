/**
 * Contrato entre a API (apps/api) e o web (apps/web) — ARQ-04.
 *
 * Aqui ficam os tipos do que trafega em JSON: datas são texto ISO 8601, dinheiro é número.
 * Só tipos, sem código: a API confere em tempo de compilação que o que ela devolve cabe nestes
 * formatos (apps/api/src/contracts-check.ts) e o web importa daqui em vez de redeclarar. Um
 * campo renomeado de um lado só deixa de compilar, em vez de quebrar em produção.
 */

/* ───────────── Envelope ───────────── */

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  /** Identificador estável do erro, por exemplo `EMAIL_NOT_VERIFIED`. */
  code?: string;
  data?: T;
  errors?: FieldError[];
  /** Dados para a tela decidir, por exemplo a lista de agendamentos afetados (DOM-02). */
  details?: Record<string, unknown>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ───────────── Contas ───────────── */

export type Role = 'USER' | 'ADMIN' | 'EMPLOYEE';

/** Usuário da sessão (`/auth/me`, login, cadastro). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  employeeId: string | null;
  avatarUrl: string | null;
  pendingEmail: string | null;
  /** Sem e-mail confirmado, o cliente não reserva. */
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  user: PublicUser;
  token: string;
}

/** Linha da lista de clientes do admin. */
export interface ClientListItem {
  id: string;
  name: string;
  /** `null` no cliente cadastrado pela recepção sem e-mail (UX-03). */
  email: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
  avatarUrl: string | null;
  appointmentCount: number;
  lastAppointmentAt: string | null;
}

/** `POST /auth/clients` (UX-03): cliente rápido cadastrado pela recepção. */
export interface CreateClientBody {
  name: string;
  phone?: string;
  email?: string;
}

export interface CreateClientResult {
  client: ClientListItem;
  /** Com e-mail, o cliente recebe o link para criar a senha. */
  activationSent: boolean;
}

/** `details` do 409 `CLIENT_EXISTS`: quem já usa o e-mail ou o telefone. */
export interface ClientExistsDetails {
  client: { id: string; name: string; role: Role };
  match: 'email' | 'phone';
}

/* ───────────── Agendamentos ───────────── */

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AppointmentClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

export interface AppointmentEmployee {
  id: string;
  name: string;
  /** Contato só para o admin: o cliente não recebe e-mail nem telefone do profissional. */
  email?: string;
  phone?: string | null;
  avatar: string | null;
}

export interface AppointmentProduct {
  id: string;
  name: string;
  duration: number;
  price: number;
}

export interface Appointment {
  id: string;
  date: string;
  endDate: string;
  status: AppointmentStatus;
  notes: string | null;
  price: number;
  client: AppointmentClient;
  product: AppointmentProduct;
  employee: AppointmentEmployee;
  createdAt: string;
  updatedAt: string;
}

/** Agendamento com o que quem pediu pode fazer agora (DOM-01, DOM-09). */
export interface AppointmentWithActions extends Appointment {
  allowedStatuses: AppointmentStatus[];
  cancellableUntil: string;
}

/** `GET /appointments` (admin, UX-09). */
export interface AppointmentPage {
  appointments: AppointmentWithActions[];
  pagination: Pagination;
  /** Período aplicado. Sem filtro, `from` é o começo de hoje. */
  period: { from: string | null; to: string | null };
}

export interface AppointmentListQuery {
  employeeId?: string;
  clientId?: string;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
  search?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/* ───────────── Disponibilidade e expediente ───────────── */

/** Pausa dentro do expediente (UX-12), ex.: almoço. Horas em `HH:mm`. */
export interface TimeRange {
  start: string;
  end: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
}

export interface Availability {
  date: string;
  employee: { id: string; name: string };
  product: { id: string; name: string; duration: number };
  businessHours: { start: string; end: string };
  breaks: TimeRange[];
  isClosed: boolean;
  slots: AvailabilitySlot[];
}

export interface DayHoursBody {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  /** Ausente = mantém as pausas já gravadas no dia. */
  breaks?: TimeRange[];
}
