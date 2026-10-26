/**
 * Checks the email settings and sends one test message.
 *   npm run mail:test -- you@college.edu
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { mailService } from '../services/mail.service.js';

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Usage: npm run mail:test -- you@college.edu');
    process.exit(1);
  }

  if (!env.SMTP_HOST) {
    console.log('SMTP_HOST is not set in server/.env, so emails are only written to', env.MAIL_OUTBOX_DIR + '/.');
    console.log('Fill in SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS and MAIL_FROM, then run this again.');
    process.exit(1);
  }

  console.log(`Connecting to ${env.SMTP_HOST}:${env.SMTP_PORT} (secure=${env.SMTP_SECURE}) as ${env.SMTP_USER || '(no login)'} ...`);
  try {
    await nodemailer
      .createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
      .verify();
  } catch (error) {
    console.error('✗ Could not log in to the mail server:', (error as Error).message);
    console.error('  Check the host/port, SMTP_SECURE (true for port 465, false for 587) and the username/app password.');
    process.exit(1);
  }
  console.log('✓ Mail server accepted the login.');

  const ok = await mailService.send({
    to,
    subject: 'FacultyCore test email',
    lines: ['This is a test message from FacultyCore.', 'If you can read this, email delivery is working.'],
  });
  if (!ok) {
    console.error('✗ The message was not accepted (see the warning above).');
    process.exit(1);
  }
  console.log(`✓ Test email sent to ${to}. Check the inbox (and spam folder).`);
}

void main();
