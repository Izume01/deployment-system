import { getValidatedEnv } from '@deployment/shared';
import cors from '@fastify/cors';
import Fastify from 'fastify';

const env = getValidatedEnv();
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
});

// Health check endpoint
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'control-api',
    timestamp: new Date().toISOString(),
  };
});

const start = async () => {
  try {
    await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
    console.log(
      `🚀 Control Plane API listening on http://0.0.0.0:${env.API_PORT}`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (import.meta.main) {
  start();
}

export { app };
