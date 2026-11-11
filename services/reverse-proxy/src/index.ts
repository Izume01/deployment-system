import { getValidatedEnv } from '@deployment/shared';
import { createProxyServer } from './server';

export * from './types';
export * from './router';
export * from './cache';
export * from './forwarder';
export * from './static-handler';
export * from './server';

if (import.meta.main) {
  const env = getValidatedEnv();
  createProxyServer({
    port: env.PROXY_PORT,
    host: '0.0.0.0',
    defaultBucket: env.GCP_SOURCE_BUCKET,
  });
}
