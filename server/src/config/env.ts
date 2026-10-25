import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5055').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  // Idle session lifetime; active sessions are renewed automatically (see refreshSessionIfStale)
  JWT_EXPIRES_IN: z.string().default('12h'),
  COOKIE_SECRET: z.string().min(1, 'COOKIE_SECRET is required'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  // Set when running behind a reverse proxy (nginx / load balancer) so client IPs are correct
  TRUST_PROXY: z.string().optional(),
  // Public base URL of the API (used in calendar feed links). Defaults to http://localhost:PORT/api
  PUBLIC_API_URL: z.string().optional(),
  // Outgoing email. Without SMTP_HOST, emails are written to MAIL_OUTBOX_DIR instead of being sent
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('KPRIET FMS <no-reply@kpriet.ac.in>'),
  MAIL_OUTBOX_DIR: z.string().default('mail-outbox'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

// In production, refuse to boot with weak or placeholder secrets (copied from .env.example)
if (parsed.data.NODE_ENV === 'production') {
  const MIN_SECRET_LENGTH = 32;
  const problems: string[] = [];
  for (const key of ['JWT_SECRET', 'COOKIE_SECRET'] as const) {
    const value = parsed.data[key];
    if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key} must be at least ${MIN_SECRET_LENGTH} characters long.`);
    }
    if (/change-in-production|your-.*-secret|secret123|changeme/i.test(value)) {
      problems.push(`${key} is still set to a placeholder value.`);
    }
  }
  if (parsed.data.JWT_SECRET === parsed.data.COOKIE_SECRET) {
    problems.push('JWT_SECRET and COOKIE_SECRET must be different.');
  }
  if (problems.length > 0) {
    console.error('Insecure production configuration:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Generate secrets with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
    process.exit(1);
  }
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
