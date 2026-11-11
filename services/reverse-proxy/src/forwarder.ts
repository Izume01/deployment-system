const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Filters out hop-by-hop headers per RFC 7230.
 */
export function filterHopByHopHeaders(headers: Headers): Headers {
  const clean = new Headers();
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      clean.set(key, value);
    }
  });
  return clean;
}

/**
 * Transparently forwards an incoming HTTP request to a Google Cloud Run service URL.
 * Preserves streaming request/response bodies, query parameters, and sets X-Forwarded headers.
 */
export async function forwardToCloudRun(
  req: Request,
  targetBaseUrl: string,
  slug: string,
): Promise<Response> {
  const reqUrl = new URL(req.url);
  const targetUrl = new URL(targetBaseUrl);

  // Construct destination URL preserving path and search query
  const destination = `${targetUrl.origin}${reqUrl.pathname}${reqUrl.search}`;

  // Prepare forwarded headers
  const forwardedHeaders = filterHopByHopHeaders(req.headers);
  forwardedHeaders.set('host', targetUrl.host);
  forwardedHeaders.set('x-forwarded-host', req.headers.get('host') || slug);
  forwardedHeaders.set(
    'x-forwarded-proto',
    req.headers.get('x-forwarded-proto') || reqUrl.protocol.replace(':', ''),
  );
  forwardedHeaders.set('x-paas-slug', slug);

  // Stream body only if HTTP method allows it
  const hasBody =
    req.method !== 'GET' && req.method !== 'HEAD' && req.body !== null;

  try {
    const upstreamResponse = await fetch(destination, {
      method: req.method,
      headers: forwardedHeaders,
      body: hasBody ? req.body : undefined,
      redirect: 'manual',
    });

    // Clean response headers
    const responseHeaders = filterHopByHopHeaders(upstreamResponse.headers);
    responseHeaders.set('x-proxied-by', 'paas-reverse-proxy');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Proxy] Error forwarding request to ${slug}: ${message}`);
    return new Response(
      JSON.stringify({
        error: 'Bad Gateway',
        message: `Failed to reach backend service for "${slug}".`,
        details: message,
      }),
      {
        status: 502,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
}
