import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgresql://user:password@localhost:5432/db'),
  DATABASE_URL_POOLED: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  API_PORT: z.coerce.number().default(4000),
  PROXY_PORT: z.coerce.number().default(8000),
  DASHBOARD_PORT: z.coerce.number().default(3000),
  PLATFORM_DOMAIN: z.string().default('localhost:8000'),
  APEX_DOMAIN: z.string().optional(),
  JWT_SECRET: z.string().default('dev-jwt-secret'),
  INTERNAL_API_KEY: z.string().default('dev-internal-secret'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  // GCP Configuration
  GCP_PROJECT_ID: z.string().default('my-paas-project'),
  GCP_REGION: z.string().default('us-central1'),
  GCP_ARTIFACT_REGISTRY: z.string().default('cloud-apps'),
  GCP_SOURCE_BUCKET: z.string().default('paas-build-sources'),
});

export type PlatformEnv = z.infer<typeof envSchema>;

export function getValidatedEnv(
  customEnv?: Record<string, string | undefined>,
): PlatformEnv {
  return envSchema.parse(customEnv ?? process.env);
}
