import { Resend } from 'resend';
import { appointmentCancelledEmail } from '../emails/appointment-cancelled';
import {
  appointmentScheduledEmail,
  type AppointmentEmailData,
} from '../emails/appointment-scheduled';
import { getInlineAttachments } from '../emails/assets';
import { professionalNewAppointmentEmail } from '../emails/professional-new-appointment';
import { passwordChangedEmail } from '../emails/password-changed';
import { passwordResetEmail } from '../emails/password-reset';
import { welcomeEmail } from '../emails/welcome';

export interface AppointmentMailInput {
  id: string;
  date: Date;
  price: number;
  notes?: string | null;
  client: { name: string; email: string };
  product: { name: string; duration: number };
  employee: { name: string; email: string };
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

  async sendAppointmentScheduled(appointment: AppointmentMailInput) {
    const content = appointmentScheduledEmail(toAppointmentEmailData(appointment));
    await this.send({
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

  async sendAppointmentCancelled(appointment: AppointmentMailInput) {
    const content = appointmentCancelledEmail(toAppointmentEmailData(appointment));
    await this.send({
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
    await this.send({
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

  async sendWelcome(user: { id: string; name: string; email: string }) {
    const content = welcomeEmail(user.name);
    await this.send({
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
    await this.send({
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
    await this.send({
      to: user.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      idempotencyKey: `password-changed/${user.id}/${user.changedAt.getTime()}`,
      tags: [{ name: 'type', value: 'password-changed' }],
    });
  }

  private async send(input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
    tags: { name: string; value: string }[];
  }) {
    if (!this.resend) {
      console.warn('[email] RESEND_API_KEY ausente — envio ignorado');
      return;
    }

    if (!this.canSendTo(input.to)) {
      console.warn(`[email] destinatário ignorado: ${input.to}`);
      return;
    }

    const attachments = getInlineAttachments();
    const { data, error } = await this.resend.emails.send(
      {
        from: this.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: attachments.length > 0 ? attachments : undefined,
        tags: input.tags,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  private canSendTo(email: string) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return !['leemia.dev'].includes(domain);
  }
}

export const emailService = new EmailService();

function dispatch(label: string, task: () => Promise<void>) {
  void task().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email] ${label} falhou: ${message}`);
  });
}

export function notifyAppointmentScheduled(appointment: AppointmentMailInput) {
  dispatch('appointment-scheduled', async () => {
    await emailService.sendAppointmentScheduled(appointment);
    await emailService.sendProfessionalNewAppointment(appointment);
  });
}

export function notifyAppointmentCancelled(appointment: AppointmentMailInput) {
  dispatch('appointment-cancelled', () => emailService.sendAppointmentCancelled(appointment));
}

export function notifyWelcome(user: { id: string; name: string; email: string }) {
  dispatch('welcome', () => emailService.sendWelcome(user));
}

export function notifyPasswordReset(input: {
  id: string;
  name: string;
  email: string;
  resetUrl: string;
  tokenId: string;
}) {
  dispatch('password-reset', () => emailService.sendPasswordReset(input));
}

export function notifyPasswordChanged(user: {
  id: string;
  name: string;
  email: string;
  changedAt: Date;
}) {
  dispatch('password-changed', () => emailService.sendPasswordChanged(user));
}
