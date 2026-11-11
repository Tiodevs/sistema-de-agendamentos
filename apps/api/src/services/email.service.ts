import { Resend } from 'resend';
import { accountActivationEmail } from '../emails/account-activation';
import { appointmentCancelledEmail } from '../emails/appointment-cancelled';
import {
  appointmentScheduledEmail,
  type AppointmentEmailData,
} from '../emails/appointment-scheduled';
import { getInlineAttachments } from '../emails/assets';
import { employeeInviteEmail } from '../emails/employee-invite';
import { professionalAppointmentCancelledEmail } from '../emails/professional-appointment-cancelled';
import { professionalNewAppointmentEmail } from '../emails/professional-new-appointment';
import { emailChangeConfirmEmail } from '../emails/email-change-confirm';
import { emailChangeNoticeEmail } from '../emails/email-change-notice';
import { emailVerificationEmail } from '../emails/email-verification';
import { passwordChangedEmail } from '../emails/password-changed';
import { passwordResetEmail } from '../emails/password-reset';
import { welcomeEmail } from '../emails/welcome';
import { consumeRateLimit } from '../lib/rate-limit';
import {
  enqueueEmail,
  type DeliveryResult,
  type EmailJob,
  type EmailJobPayload,
} from './email-outbox.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Teto de e-mails por destinatário em 24h (SEC-02). Protege a caixa de terceiros e a cota do
 * Resend quando alguém cadastra o e-mail de outra pessoa ou repete reservas e cancelamentos.
 */
const DAILY_LIMIT_PER_RECIPIENT = 50;
const DAILY_LIMIT_BY_TYPE: Record<string, number> = {
  'email-verification': 5,
  'password-reset': 10,
  'employee-invite': 5,
  'account-activation': 3,
};

export interface AppointmentMailInput {
  id: string;
  date: Date;
  price: number;
  notes?: string | null;
  /** `email: null` = cliente cadastrado pela recepção sem e-mail (UX-03): não recebe aviso. */
  client: { name: string; email: string | null };
  product: { name: string; duration: number };
  employee: { name: string; email: string };
}

export interface CancellationMailOptions {
  /** `client`: o próprio cliente cancelou. `studio`: admin, profissional ou mudança de expediente. */
  cancelledBy?: 'client' | 'studio';
  /** Motivo mostrado ao cliente quando o estúdio cancela. */
  reason?: string | null;
  /** Avisar também o profissional (não precisa quando foi ele quem cancelou). */
  notifyProfessional?: boolean;
}

function toAppointmentEmailData(input: AppointmentMailInput): AppointmentEmailData {
  return {
    clientName: input.client.name,
    productName: input.product.name,
    professionalName: input.employee.name,
    date: input.date,
    duration: input.product.duration,
    price: input.price,
    notes: input.notes,
  };
}

const NO_CLIENT_EMAIL: DeliveryResult = { status: 'skipped', reason: 'cliente sem e-mail' };

class EmailService {
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = process.env.EMAIL_FROM || 'Leemia <agendamentos@mefelipe.com.br>';
  }

  isConfigured() {
    return Boolean(this.resend);
  }

  async sendAppointmentScheduled(appointment: AppointmentMailInput): Promise<DeliveryResult> {
    if (!appointment.client.email) return NO_CLIENT_EMAIL;
    const content = appointmentScheduledEmail(toAppointmentEmailData(appointment));
    return this.send({
      to: appointment.client.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `appointment-scheduled/${appointment.id}`,
      tags: [
        { name: 'type', value: 'appointment-scheduled' },
        { name: 'appointment-id', value: appointment.id.slice(0, 32) },
      ],
    });
  }

  async sendAppointmentCancelled(
    appointment: AppointmentMailInput,
    options: CancellationMailOptions = {},
  ): Promise<DeliveryResult> {
    if (!appointment.client.email) return NO_CLIENT_EMAIL;
    const content = appointmentCancelledEmail({
      ...toAppointmentEmailData(appointment),
      cancelledBy: options.cancelledBy,
      reason: options.reason,
    });
    return this.send({
      to: appointment.client.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `appointment-cancelled/${appointment.id}`,
      tags: [
        { name: 'type', value: 'appointment-cancelled' },
        { name: 'appointment-id', value: appointment.id.slice(0, 32) },
      ],
    });
  }

  async sendProfessionalNewAppointment(appointment: AppointmentMailInput) {
    const content = professionalNewAppointmentEmail(toAppointmentEmailData(appointment));
    return this.send({
      to: appointment.employee.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `professional-new-appointment/${appointment.id}`,
      tags: [
        { name: 'type', value: 'professional-new-appointment' },
        { name: 'appointment-id', value: appointment.id.slice(0, 32) },
      ],
    });
  }

  async sendProfessionalAppointmentCancelled(
    appointment: AppointmentMailInput,
    options: CancellationMailOptions = {},
  ) {
    const content = professionalAppointmentCancelledEmail({
      ...toAppointmentEmailData(appointment),
      cancelledBy: options.cancelledBy,
    });
    return this.send({
      to: appointment.employee.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `professional-appointment-cancelled/${appointment.id}`,
      tags: [
        { name: 'type', value: 'professional-appointment-cancelled' },
        { name: 'appointment-id', value: appointment.id.slice(0, 32) },
      ],
    });
  }

  async sendEmployeeInvite(input: {
    name: string;
    email: string;
    acceptUrl: string;
    inviteId: string;
  }) {
    const content = employeeInviteEmail(input.name, input.acceptUrl);
    return this.send({
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `employee-invite/${input.inviteId}`,
      tags: [{ name: 'type', value: 'employee-invite' }],
    });
  }

  async sendAccountActivation(input: {
    id: string;
    name: string;
    email: string;
    activateUrl: string;
    tokenId: string;
  }) {
    const content = accountActivationEmail(input.name, input.activateUrl);
    return this.send({
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `account-activation/${input.tokenId}`,
      tags: [{ name: 'type', value: 'account-activation' }],
    });
  }

  async sendWelcome(user: { id: string; name: string; email: string }) {
    const content = welcomeEmail(user.name);
    return this.send({
      to: user.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `welcome-email/${user.id}`,
      tags: [{ name: 'type', value: 'welcome' }],
    });
  }

  async sendPasswordReset(input: {
    id: string;
    name: string;
    email: string;
    resetUrl: string;
    tokenId: string;
  }) {
    const content = passwordResetEmail(input.name, input.resetUrl);
    return this.send({
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `password-reset/${input.tokenId}`,
      tags: [{ name: 'type', value: 'password-reset' }],
    });
  }

  async sendPasswordChanged(user: { id: string; name: string; email: string; changedAt: Date }) {
    const content = passwordChangedEmail(user.name);
    return this.send({
      to: user.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `password-changed/${user.id}/${user.changedAt.getTime()}`,
      tags: [{ name: 'type', value: 'password-changed' }],
    });
  }

  async sendEmailChangeConfirm(input: {
    id: string;
    name: string;
    email: string;
    confirmUrl: string;
    tokenId: string;
  }) {
    const content = emailChangeConfirmEmail(input.name, input.confirmUrl);
    return this.send({
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `email-change-confirm/${input.tokenId}`,
      tags: [{ name: 'type', value: 'email-change-confirm' }],
    });
  }

  async sendEmailVerification(input: {
    id: string;
    name: string;
    email: string;
    confirmUrl: string;
    tokenId: string;
  }) {
    const content = emailVerificationEmail(input.name, input.confirmUrl);
    return this.send({
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `email-verification/${input.tokenId}`,
      tags: [{ name: 'type', value: 'email-verification' }],
    });
  }

  async sendEmailChangeNotice(input: {
    id: string;
    name: string;
    email: string;
    newEmail: string;
    tokenId: string;
  }) {
    const content = emailChangeNoticeEmail(input.name, input.newEmail);
    return this.send({
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `email-change-notice/${input.tokenId}`,
      tags: [{ name: 'type', value: 'email-change-notice' }],
    });
  }

  /**
   * Primeira tentativa de um job da fila? Só ela conta no teto diário por destinatário: uma nova
   * tentativa do mesmo e-mail não pode gastar a cota de novo.
   */
  firstAttempt = true;

  private async send(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
    tags: { name: string; value: string }[];
  }): Promise<DeliveryResult> {
    if (!this.resend) {
      return { status: 'skipped', reason: 'RESEND_API_KEY ausente' };
    }

    if (!this.canSendTo(input.to)) {
      return { status: 'skipped', reason: 'destinatário bloqueado' };
    }

    const type = input.tags.find((tag) => tag.name === 'type')?.value ?? 'other';
    if (this.firstAttempt && !this.withinDailyLimit(input.to, type)) {
      return { status: 'skipped', reason: `limite diário de ${type} atingido` };
    }

    const attachments = getInlineAttachments();
    const { error } = await this.resend.emails.send(
      {
        from: this.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: attachments.length > 0 ? attachments : undefined,
        tags: input.tags,
      },
      // O Resend descarta a repetição da mesma chave: uma nova tentativa não duplica o e-mail.
      { idempotencyKey: input.idempotencyKey },
    );

    if (error) {
      throw new Error(error.message);
    }

    return { status: 'sent' };
  }

  private canSendTo(email: string) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return !['leemia.dev'].includes(domain);
  }

  private withinDailyLimit(to: string, type: string) {
    const recipient = to.trim().toLowerCase();
    const typeLimit = DAILY_LIMIT_BY_TYPE[type];
    if (typeLimit && !consumeRateLimit(`email-to:${type}:${recipient}`, typeLimit, DAY_MS)) {
      return false;
    }
    return consumeRateLimit(`email-to:${recipient}`, DAILY_LIMIT_PER_RECIPIENT, DAY_MS);
  }
}

export const emailService = new EmailService();

/* ───────────── Fila (ARQ-02) ─────────────
   Os `notify*` não enviam: gravam o e-mail em `email_outbox` e o worker entrega, com nova
   tentativa. O conteúdo vai como JSON, então as datas voltam de texto em `deliverEmailJob`. */

type AppointmentJob = { appointment: AppointmentMailInput; options?: CancellationMailOptions };

function reviveAppointment(value: unknown): AppointmentMailInput {
  const appointment = value as AppointmentMailInput & { date: string | Date };
  return { ...appointment, date: new Date(appointment.date) };
}

const HANDLERS: Record<string, (payload: EmailJobPayload) => Promise<DeliveryResult>> = {
  'appointment-scheduled': (payload) =>
    emailService.sendAppointmentScheduled(reviveAppointment(payload.appointment)),
  'professional-new-appointment': (payload) =>
    emailService.sendProfessionalNewAppointment(reviveAppointment(payload.appointment)),
  'appointment-cancelled': (payload) =>
    emailService.sendAppointmentCancelled(
      reviveAppointment(payload.appointment),
      (payload as AppointmentJob).options,
    ),
  'professional-appointment-cancelled': (payload) =>
    emailService.sendProfessionalAppointmentCancelled(
      reviveAppointment(payload.appointment),
      (payload as AppointmentJob).options,
    ),
  'employee-invite': (payload) =>
    emailService.sendEmployeeInvite(payload as Parameters<EmailService['sendEmployeeInvite']>[0]),
  'account-activation': (payload) =>
    emailService.sendAccountActivation(
      payload as Parameters<EmailService['sendAccountActivation']>[0],
    ),
  welcome: (payload) =>
    emailService.sendWelcome(payload as Parameters<EmailService['sendWelcome']>[0]),
  'password-reset': (payload) =>
    emailService.sendPasswordReset(payload as Parameters<EmailService['sendPasswordReset']>[0]),
  'password-changed': (payload) => {
    const input = payload as { id: string; name: string; email: string; changedAt: string };
    return emailService.sendPasswordChanged({ ...input, changedAt: new Date(input.changedAt) });
  },
  'email-change-confirm': (payload) =>
    emailService.sendEmailChangeConfirm(
      payload as Parameters<EmailService['sendEmailChangeConfirm']>[0],
    ),
  'email-verification': (payload) =>
    emailService.sendEmailVerification(
      payload as Parameters<EmailService['sendEmailVerification']>[0],
    ),
  'email-change-notice': (payload) =>
    emailService.sendEmailChangeNotice(
      payload as Parameters<EmailService['sendEmailChangeNotice']>[0],
    ),
};

/** Entrega um job da fila: monta o e-mail do tipo e envia. Tipo desconhecido não é tentado de novo. */
export async function deliverEmailJob(job: EmailJob): Promise<DeliveryResult> {
  const handler = HANDLERS[job.type];
  if (!handler) return { status: 'skipped', reason: `tipo desconhecido: ${job.type}` };
  emailService.firstAttempt = job.attempts <= 1;
  try {
    return await handler(job.payload);
  } finally {
    emailService.firstAttempt = true;
  }
}

function queue(type: string, recipient: string, idempotencyKey: string, payload: object) {
  void enqueueEmail({
    type,
    recipient,
    idempotencyKey,
    payload: JSON.parse(JSON.stringify(payload)) as EmailJobPayload,
  });
}

export function notifyAppointmentScheduled(appointment: AppointmentMailInput) {
  if (appointment.client.email) {
    queue(
      'appointment-scheduled',
      appointment.client.email,
      `appointment-scheduled/${appointment.id}`,
      { appointment },
    );
  }
  queue(
    'professional-new-appointment',
    appointment.employee.email,
    `professional-new-appointment/${appointment.id}`,
    { appointment },
  );
}

export function notifyAppointmentCancelled(
  appointment: AppointmentMailInput,
  options: CancellationMailOptions = {},
) {
  if (appointment.client.email) {
    queue(
      'appointment-cancelled',
      appointment.client.email,
      `appointment-cancelled/${appointment.id}`,
      { appointment, options },
    );
  }
  if (options.notifyProfessional) {
    queue(
      'professional-appointment-cancelled',
      appointment.employee.email,
      `professional-appointment-cancelled/${appointment.id}`,
      { appointment, options },
    );
  }
}

export function notifyEmployeeInvite(input: {
  name: string;
  email: string;
  acceptUrl: string;
  inviteId: string;
}) {
  queue('employee-invite', input.email, `employee-invite/${input.inviteId}`, input);
}

export function notifyAccountActivation(input: {
  id: string;
  name: string;
  email: string;
  activateUrl: string;
  tokenId: string;
}) {
  queue('account-activation', input.email, `account-activation/${input.tokenId}`, input);
}

export function notifyWelcome(user: { id: string; name: string; email: string }) {
  queue('welcome', user.email, `welcome-email/${user.id}`, user);
}

export function notifyPasswordReset(input: {
  id: string;
  name: string;
  email: string;
  resetUrl: string;
  tokenId: string;
}) {
  queue('password-reset', input.email, `password-reset/${input.tokenId}`, input);
}

export function notifyPasswordChanged(user: {
  id: string;
  name: string;
  email: string;
  changedAt: Date;
}) {
  queue(
    'password-changed',
    user.email,
    `password-changed/${user.id}/${user.changedAt.getTime()}`,
    user,
  );
}

export function notifyEmailChangeConfirm(input: {
  id: string;
  name: string;
  email: string;
  confirmUrl: string;
  tokenId: string;
}) {
  queue('email-change-confirm', input.email, `email-change-confirm/${input.tokenId}`, input);
}

export function notifyEmailVerification(input: {
  id: string;
  name: string;
  email: string;
  confirmUrl: string;
  tokenId: string;
}) {
  queue('email-verification', input.email, `email-verification/${input.tokenId}`, input);
}

export function notifyEmailChangeNotice(input: {
  id: string;
  name: string;
  email: string;
  newEmail: string;
  tokenId: string;
}) {
  queue('email-change-notice', input.email, `email-change-notice/${input.tokenId}`, input);
}
