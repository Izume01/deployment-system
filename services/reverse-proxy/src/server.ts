import { routeRegistry } from './cache';
import { forwardToCloudRun } from './forwarder';
import { extractSlug } from './router';
import { streamStaticFromGCS } from './static-handler';
import type { ProxyServerConfig, RegisterRouteInput } from './types';

/**
 * Handles incoming HTTP requests for the reverse proxy.
 */
export async function handleProxyRequest(
  req: Request,
  apexDomain?: string,
): Promise<Response> {
  const url = new URL(req.url);

  // 1. Extract project slug from Host header (e.g. "my-app.localhost:8000")
  const hostHeader = req.headers.get('host');
  const slug = extractSlug(hostHeader, apexDomain);

  // 2. If visiting root proxy without a subdomain (e.g. localhost:8000), serve system endpoints
  if (!slug) {
    if (url.pathname === '/health' && req.method === 'GET') {
      return Response.json({
        status: 'ok',
        service: 'reverse-proxy',
        activeRoutes: routeRegistry.size,
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === '/api/routes' && req.method === 'GET') {
      return Response.json({ routes: routeRegistry.list() });
    }

    if (url.pathname === '/api/routes' && req.method === 'POST') {
      try {
        const body = (await req.json()) as RegisterRouteInput;
        if (!body.slug || !body.target) {
          return Response.json(
            { error: 'Missing slug or target' },
            { status: 400 },
          );
        }
        const route = routeRegistry.register(body);
        return Response.json({ success: true, route });
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }

    return Response.json({
      service: 'paas-reverse-proxy',
      status: 'ready',
      message: 'Cloud-native reverse proxy edge router active.',
      activeRoutes: routeRegistry.size,
    });
  }

  // 3. Resolve destination route from in-memory registry
  const route = routeRegistry.resolve(slug);
  if (!route) {
    return Response.json(
      {
        error: 'Not Found',
        message: `Project "${slug}" was not found or deployment is still starting.`,
      },
      { status: 404 },
    );
  }

  // 4. Route traffic to destination target
  if (route.type === 'static-gcs') {
    return streamStaticFromGCS(route.target, url.pathname);
  }

  return forwardToCloudRun(req, route.target, slug);
}

/**
 * Creates and starts the reverse proxy HTTP server.
 */
export function createProxyServer(config: ProxyServerConfig) {
  const { port, host } = config;

  const server = Bun.serve({
    port,
    hostname: host,
    fetch(req) {
      return handleProxyRequest(req);
    },
  });

  console.log(`[Proxy] Reverse Proxy listening on http://${host}:${port}`);
  return server;
}
