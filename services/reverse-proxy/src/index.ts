import { type RouteEntry, getValidatedEnv } from '@deployment/shared';
import Fastify from 'fastify';

const env = getValidatedEnv();
const app = Fastify({ logger: true });

// In-memory dynamic routing table: Map<slug, RouteEntry>
export const routeRegistry = new Map<string, RouteEntry>();

// Health check endpoint
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'reverse-proxy',
    activeRoutes: routeRegistry.size,
    timestamp: new Date().toISOString(),
  };
});

// Internal API to register a route dynamically
app.post<{ Body: { slug: string; target: string; containerId: string } }>(
  '/api/routes',
  async (request, reply) => {
    const { slug, target, containerId } = request.body;
    if (!slug || !target) {
      return reply.status(400).send({ error: 'Missing slug or target' });
    }

    routeRegistry.set(slug, {
      slug,
      target,
      containerId,
      isWarm: true,
      lastActiveAt: new Date(),
    });

    return { success: true, slug, target };
  },
);

const start = async () => {
  try {
    await app.listen({ port: env.PROXY_PORT, host: '0.0.0.0' });
    console.log(
      `🌐 Reverse Proxy listening on http://0.0.0.0:${env.PROXY_PORT}`,
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
