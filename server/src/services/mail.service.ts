import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { PRODUCT_NAME, PRODUCT_FULL_NAME } from '../config/brand.js';
import { currentTenant } from '../tenancy/context.js';
import { getInstitutionProfile } from '../utils/institution.js';

export interface MailMessage {
  to: string;
  subject: string;
  /** Short paragraphs shown in the email body (plain text, escaped when rendered). */
  lines: string[];
  /** Optional call-to-action button. */
  action?: { label: string; url: string };
  /** Optional large code (e.g. a verification code). */
  code?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Who the email is from: the institution (when sent inside one) on the FacultyCore platform. */
interface Brand {
  /** Header line, e.g. "Demo Institute of Technology" */
  title: string;
  accent: string;
  /** Short code prefixed to subjects, e.g. "DIT" */
  short?: string;
  footer: string;
  contactEmail?: string;
}

const PLATFORM_BRAND: Brand = {
  title: PRODUCT_FULL_NAME,
  accent: '#0b3d91',
  footer: `This is an automated message from ${PRODUCT_NAME}. Please do not reply.`,
};

async function brandForCurrentInstitution(): Promise<Brand> {
  if (!currentTenant()) return PLATFORM_BRAND;
  try {
    const p = await getInstitutionProfile();
    return {
      title: p.name,
      accent: /^#[0-9a-fA-F]{6}$/.test(p.accentColor) ? p.accentColor : PLATFORM_BRAND.accent,
      short: p.shortCode,
      contactEmail: p.contactEmail,
      footer: `Sent by ${p.name} through ${PRODUCT_NAME}. This is an automated message; please do not reply.${p.contactEmail ? ` For help, contact ${p.contactEmail}.` : ''}`,
    };
  } catch {
    return PLATFORM_BRAND;
  }
}

/** "Name <address>" from MAIL_FROM with the institution's name shown as the sender. */
function fromFor(brand: Brand): string {
  const address = /<([^>]+)>/.exec(env.MAIL_FROM)?.[1] ?? env.MAIL_FROM;
  const display = brand === PLATFORM_BRAND ? PRODUCT_NAME : `${brand.title} via ${PRODUCT_NAME}`;
  return `"${display.replace(/["\\\r\n<>]/g, '')}" <${address}>`;
}

function renderHtml(msg: MailMessage, brand: Brand): string {
  const accent = brand.accent;
  const paragraphs = msg.lines.map((l) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(l)}</p>`).join('');
  const code = msg.code
    ? `<p style="margin:6px 0 18px;font-size:28px;font-weight:700;letter-spacing:6px;color:${accent}">${escapeHtml(msg.code)}</p>`
    : '';
  const action = msg.action
    ? `<p style="margin:8px 0 18px"><a href="${escapeHtml(msg.action.url)}" style="background:${accent};color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(msg.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#667">Or open this link: ${escapeHtml(msg.action.url)}</p>`
    : '';
  const sub = brand === PLATFORM_BRAND ? '' : `<div style="font-weight:400;font-size:12px;opacity:.85">${escapeHtml(PRODUCT_NAME)}</div>`;
  return `<!doctype html><html><body style="margin:0;background:#f3f5f9;font-family:Segoe UI,Arial,sans-serif;color:#1d2433">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e6ee">
    <div style="background:${accent};color:#fff;padding:16px 22px;font-weight:700">${escapeHtml(brand.title)}${sub}</div>
    <div style="padding:22px">${paragraphs}${code}${action}</div>
    <div style="padding:12px 22px;font-size:12px;color:#778;border-top:1px solid #eef0f4">${escapeHtml(brand.footer)}</div>
  </div></body></html>`;
}

function renderText(msg: MailMessage, brand: Brand): string {
  return [
    ...msg.lines,
    ...(msg.code ? ['', msg.code, ''] : []),
    ...(msg.action ? [`${msg.action.label}: ${msg.action.url}`] : []),
    '',
    `— ${brand.footer}`,
  ].join('\n');
}

/** Writes the email to the outbox folder (development, or when SMTP is not configured). */
async function writeToOutbox(msg: MailMessage, from: string, html: string, text: string): Promise<string> {
  const dir = path.resolve(process.cwd(), env.MAIL_OUTBOX_DIR);
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${stamp}-${crypto.randomBytes(3).toString('hex')}.json`);
  await fs.writeFile(
    file,
    JSON.stringify({ from, to: msg.to, subject: msg.subject, text, html, code: msg.code, action: msg.action, sentAt: new Date() }, null, 2)
  );
  return file;
}

export const mailService = {
  /**
   * Sends an email. Never throws: email is best-effort and must not break the request that
   * triggered it. Returns true when the message was accepted (or written to the outbox).
   */
  async send(input: MailMessage): Promise<boolean> {
    // Every email names the institution it comes from (subject prefix, sender name, header, footer)
    const brand = await brandForCurrentInstitution();
    const msg = brand.short && !input.subject.startsWith(`[${brand.short}]`) ? { ...input, subject: `[${brand.short}] ${input.subject}` } : input;
    const html = renderHtml(msg, brand);
    const text = renderText(msg, brand);
    const from = fromFor(brand);
    try {
      const smtp = getTransporter();
      if (smtp) {
        await smtp.sendMail({ from, to: msg.to, subject: msg.subject, html, text });
      } else {
        const file = await writeToOutbox(msg, from, html, text);
        if (env.NODE_ENV !== 'test') logger.info(`Email "${msg.subject}" to ${msg.to} written to ${file} (SMTP not configured)`);
      }
      return true;
    } catch (error) {
      logger.warn(`Email "${msg.subject}" to ${msg.to} could not be sent`, { error: (error as Error).message });
      return false;
    }
  },

  /** Fire-and-forget variant for notifications triggered inside other workflows. */
  queue(msg: MailMessage): void {
    void this.send(msg);
  },
};

/** Absolute link into the web app, e.g. clientUrl('/reset-password?token=…'). */
export function clientUrl(pathAndQuery: string): string {
  const base = `${env.CLIENT_URL.replace(/\/$/, '')}${pathAndQuery}`;
  // Links always name the institution, so they also work on a device that has not chosen one
  const code = currentTenant()?.code;
  if (!code) return base;
  return `${base}${base.includes('?') ? '&' : '?'}institution=${encodeURIComponent(code)}`;
}
