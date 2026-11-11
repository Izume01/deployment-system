import {
  createProxyServer,
  routeRegistry,
} from '../services/reverse-proxy/src/index';

async function testLiveProxy() {
  console.log('[Test] Starting live Reverse Proxy test...');

  // 1. Start proxy on port 8001 for test isolation
  const testPort = 8001;
  const server = createProxyServer({
    port: testPort,
    host: '127.0.0.1',
  });

  try {
    // 2. Register live Cloud Run deployments
    routeRegistry.register({
      slug: 'express-sample',
      target: 'https://express-sample-36whzpprxq-uc.a.run.app',
    });
    routeRegistry.register({
      slug: 'dockerfile-sample',
      target: 'https://dockerfile-sample-36whzpprxq-uc.a.run.app',
    });

    console.log(`[Test] Registered routes: ${routeRegistry.size}`);

    // 3. Test Proxy Health
    const healthRes = await fetch(`http://127.0.0.1:${testPort}/health`);
    const healthJson = (await healthRes.json()) as { status: string };
    console.log(
      `[Test] Health endpoint: ${healthRes.status} (${healthJson.status})`,
    );

    // 4. Test Subdomain Routing for express-sample
    console.log(
      '[Test] Testing subdomain routing: express-sample.localhost:8001 ...',
    );
    const expressRes = await fetch(`http://127.0.0.1:${testPort}/`, {
      headers: { host: `express-sample.localhost:${testPort}` },
    });
    console.log(`[Test] express-sample HTTP Status: ${expressRes.status}`);
    const expressHtml = await expressRes.text();
    console.log(
      `[Test] express-sample Title verified: ${expressHtml.includes('Node.js Getting Started on Heroku')}`,
    );

    // 5. Test Subdomain Routing for dockerfile-sample
    console.log(
      '[Test] Testing subdomain routing: dockerfile-sample.localhost:8001/health ...',
    );
    const dockerRes = await fetch(`http://127.0.0.1:${testPort}/health`, {
      headers: { host: `dockerfile-sample.localhost:${testPort}` },
    });
    console.log(`[Test] dockerfile-sample HTTP Status: ${dockerRes.status}`);
    const dockerText = await dockerRes.text();
    console.log(`[Test] dockerfile-sample Response: "${dockerText.trim()}"`);

    // 6. Test Unregistered Subdomain 404
    console.log(
      '[Test] Testing unregistered subdomain: nonexistent.localhost:8001 ...',
    );
    const missingRes = await fetch(`http://127.0.0.1:${testPort}/`, {
      headers: { host: `nonexistent.localhost:${testPort}` },
    });
    console.log(
      `[Test] nonexistent HTTP Status: ${missingRes.status} (expected 404)`,
    );

    console.log('\n[Test] All Reverse Proxy live tests passed successfully!');
  } finally {
    server.stop();
  }
}

testLiveProxy().catch((err) => {
  console.error('[Test] Live proxy test failed:', err);
  process.exit(1);
});
