import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgresql://user:password@localhost:5432/db'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  PROXY_PORT: z.coerce.number().default(8000),
  DASHBOARD_PORT: z.coerce.number().default(3000),
  PLATFORM_DOMAIN: z.string().default('localhost:8000'),
  INTERNAL_API_KEY: z.string().default('dev-internal-secret'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type PlatformEnv = z.infer<typeof envSchema>;

export function getValidatedEnv(
  customEnv?: Record<string, string | undefined>,
): PlatformEnv {
  return envSchema.parse(customEnv ?? process.env);
}
