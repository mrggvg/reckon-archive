import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  // Login attempts allowed per address per quarter hour. Configurable so a
  // test run isn't throttled by a limit meant for the open internet.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  // One connection per instance on a serverless host: every warm function has
  // its own pool, and a free-tier database counts them all. A long-running
  // server wants the opposite, so this is set per deployment rather than
  // guessed from the environment.
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
  // AJPES answers for every entity in the business register, but only for an
  // account with a subscribed scheme and query units to spend. Without these
  // the lookup falls back to VIES, which needs nothing and covers every
  // VAT-registered company.
  AJPES_USER: z.string().optional(),
  AJPES_PASSWORD: z.string().optional(),
  AJPES_SCHEME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    z.flattenError(parsed.error).fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
