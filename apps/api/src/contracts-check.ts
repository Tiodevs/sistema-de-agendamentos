/**
 * Conferência do contrato com o web (ARQ-04), em tempo de compilação. Nada daqui roda: cada
 * `Assert` abaixo só compila se o que a API devolve, depois de virar JSON, cabe no tipo de
 * `@agendamentos/contracts` que o web usa. Renomear ou remover um campo num service quebra o
 * `tsc` aqui, em vez de quebrar a tela em produção.
 */
import type {
  AppointmentPage,
  AppointmentWithActions,
  AuthSession,
  Availability,
  ClientListItem,
  CreateClientResult,
  PublicUser,
} from '@agendamentos/contracts';
import type { AppointmentService } from './services/appointment.service';
import type { withStatusActions } from './services/appointment-status.service';
import type { AuthService } from './services/auth.service';

/** O tipo como chega ao cliente: `Date` vira texto e `undefined` some. */
type Jsonify<T> = T extends Date
  ? string
  : T extends Array<infer Item>
    ? Jsonify<Item>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

type Assert<T extends true> = T;
type Fits<Actual, Contract> = [Actual] extends [Contract] ? true : false;

type Resolved<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

type MappedAppointment = Resolved<AppointmentService['findById']>;
type AppointmentForAdmin = ReturnType<typeof withStatusActions<MappedAppointment>>;
type AdminPage = Resolved<AppointmentService['findPage']>;

export type ContractChecks = [
  Assert<Fits<Jsonify<Resolved<AuthService['getProfile']>>, PublicUser>>,
  Assert<Fits<Jsonify<Resolved<AuthService['login']>>, AuthSession>>,
  Assert<Fits<Jsonify<Resolved<AuthService['register']>>, AuthSession>>,
  Assert<Fits<Jsonify<Resolved<AuthService['getClients']>['clients'][number]>, ClientListItem>>,
  Assert<Fits<Jsonify<Resolved<AuthService['createClient']>>, CreateClientResult>>,
  Assert<Fits<Jsonify<AppointmentForAdmin>, AppointmentWithActions>>,
  Assert<Fits<Jsonify<AdminPage['pagination']>, AppointmentPage['pagination']>>,
  Assert<Fits<Jsonify<AdminPage['period']>, AppointmentPage['period']>>,
  Assert<Fits<Jsonify<Resolved<AppointmentService['getAvailableSlots']>>, Availability>>,
];
