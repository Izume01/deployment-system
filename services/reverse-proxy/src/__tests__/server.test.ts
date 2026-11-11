import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { routeRegistry } from '../cache';
import { handleProxyRequest } from '../server';

describe('Reverse Proxy Server Integration', () => {
  let mockBackendServer: ReturnType<typeof Bun.serve>;
  const mockPort = 9922;

  beforeAll(() => {
    mockBackendServer = Bun.serve({
      port: mockPort,
      fetch(req) {
        const url = new URL(req.url);
        return Response.json({
          receivedPath: url.pathname,
          receivedQuery: url.search,
          forwardedHost: req.headers.get('x-forwarded-host'),
        });
      },
    });

    routeRegistry.clear();
  });

  afterAll(() => {
    mockBackendServer.stop();
    routeRegistry.clear();
  });

  it('should return health check status on /health', async () => {
    const req = new Request('http://localhost:8000/health');
    const res = await handleProxyRequest(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('reverse-proxy');
  });

  it('should register a route via /api/routes POST', async () => {
    const req = new Request('http://localhost:8000/api/routes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'demo-app',
        target: `http://localhost:${mockPort}`,
      }),
    });

    const res = await handleProxyRequest(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      route: { slug: string };
    };
    expect(body.success).toBe(true);
    expect(body.route.slug).toBe('demo-app');
  });

  it('should return 404 for an unregistered subdomain', async () => {
    const req = new Request('http://nonexistent.localhost:8000/', {
      headers: { host: 'nonexistent.localhost:8000' },
    });
    const res = await handleProxyRequest(req);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Not Found');
  });

  it('should proxy traffic transparently for a registered subdomain', async () => {
    const req = new Request('http://demo-app.localhost:8000/api/users?page=2', {
      headers: { host: 'demo-app.localhost:8000' },
    });
    const res = await handleProxyRequest(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      receivedPath: string;
      receivedQuery: string;
      forwardedHost: string;
    };
    expect(body.receivedPath).toBe('/api/users');
    expect(body.receivedQuery).toBe('?page=2');
    expect(body.forwardedHost).toBe('demo-app.localhost:8000');
  });
});
