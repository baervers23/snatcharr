import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getAllSettings } from "./db/settings";
import { logger } from "./logger";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export async function resolveSmtpConfig(
  overrides?: Partial<SmtpConfig>,
): Promise<SmtpConfig | null> {
  const settings = await getAllSettings();
  const host = (overrides?.host ?? settings.smtpHost ?? process.env.SMTP_HOST ?? "").trim();
  if (!host) return null;

  const portRaw =
    overrides?.port ?? settings.smtpPort ?? (Number(process.env.SMTP_PORT) || 587);
  const port = Number.isFinite(portRaw) ? Number(portRaw) : 587;

  return {
    host,
    port,
    user: (overrides?.user ?? settings.smtpUser ?? process.env.SMTP_USER ?? "").trim(),
    password: overrides?.password ?? settings.smtpPassword ?? process.env.SMTP_PASSWORD ?? "",
    from: (
      overrides?.from ??
      settings.smtpFrom ??
      process.env.SMTP_FROM ??
      "snatcharr@localhost"
    ).trim(),
  };
}

export async function isMailConfigured(): Promise<boolean> {
  return (await resolveSmtpConfig()) !== null;
}

function createTransport(config: SmtpConfig): Transporter {
  const auth =
    config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth,
  });
}

export async function verifySmtpConfig(
  overrides?: Partial<SmtpConfig>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await resolveSmtpConfig(overrides);
  if (!config) return { ok: false, error: "SMTP host is not configured" };

  const transport = createTransport(config);
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SMTP connection failed",
    };
  } finally {
    transport.close();
  }
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  smtp?: Partial<SmtpConfig>;
}

export async function sendMail(
  options: SendMailOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await resolveSmtpConfig(options.smtp);
  if (!config) return { ok: false, error: "SMTP is not configured" };

  const transport = createTransport(config);
  try {
    await transport.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    logger.warn("Mail", message);
    return { ok: false, error: message };
  } finally {
    transport.close();
  }
}

export async function sendTestEmail(
  to: string,
  smtp?: Partial<SmtpConfig>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const verify = await verifySmtpConfig(smtp);
  if (!verify.ok) return verify;

  return sendMail({
    to,
    subject: "Snatcharr SMTP test",
    text: "This is a test email from Snatcharr. SMTP is configured correctly.",
    html: "<p>This is a test email from <strong>Snatcharr</strong>. SMTP is configured correctly.</p>",
    smtp,
  });
}
