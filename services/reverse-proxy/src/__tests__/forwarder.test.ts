import { describe, expect, it } from 'bun:test';
import { filterHopByHopHeaders, forwardToCloudRun } from '../forwarder';

describe('HTTP Forwarder', () => {
  it('should filter out hop-by-hop headers', () => {
    const headers = new Headers({
      connection: 'keep-alive',
      'keep-alive': 'timeout=5',
      'transfer-encoding': 'chunked',
      'content-type': 'application/json',
      authorization: 'Bearer token',
    });

    const filtered = filterHopByHopHeaders(headers);
    expect(filtered.has('connection')).toBe(false);
    expect(filtered.has('keep-alive')).toBe(false);
    expect(filtered.has('transfer-encoding')).toBe(false);
    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('authorization')).toBe('Bearer token');
  });

  it('should forward request to upstream and stream response', async () => {
    // Spin up a dummy upstream server
    const upstream = Bun.serve({
      port: 9911,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/hello') {
          return new Response(
            JSON.stringify({
              msg: 'hello from upstream',
              host: req.headers.get('host'),
              forwardedHost: req.headers.get('x-forwarded-host'),
            }),
            { headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('not found', { status: 404 });
      },
    });

    try {
      const incoming = new Request('http://my-app.localhost:8000/hello?q=1', {
        headers: { host: 'my-app.localhost:8000' },
      });

      const response = await forwardToCloudRun(
        incoming,
        'http://localhost:9911',
        'my-app',
      );
      expect(response.status).toBe(200);

      const json = (await response.json()) as {
        msg: string;
        host: string;
        forwardedHost: string;
      };
      expect(json.msg).toBe('hello from upstream');
      expect(json.host).toBe('localhost:9911');
      expect(json.forwardedHost).toBe('my-app.localhost:8000');
    } finally {
      upstream.stop();
    }
  });

  it('should return 502 Bad Gateway if upstream server is unreachable', async () => {
    const incoming = new Request('http://offline.localhost:8000/');
    const response = await forwardToCloudRun(
      incoming,
      'http://127.0.0.1:49999',
      'offline',
    );
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Bad Gateway');
  });
});
