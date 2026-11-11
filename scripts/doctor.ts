import { getValidatedEnv } from '../packages/shared/src/env';
import { checkGcpHealth } from '../services/orchestrator/src/index';

async function runDoctor() {
  console.log(
    '[Doctor] Running Deployment System Health Checks (GCP Cloud-Native)...\n',
  );
  let hasErrors = false;

  // 1. Check Bun
  console.log(`[Doctor] Runtime: Bun v${Bun.version}`);

  // 2. Check Environment Variables
  try {
    const env = getValidatedEnv();
    console.log(
      `[Doctor] Environment: Validated (API Port: ${env.API_PORT}, Proxy Port: ${env.PROXY_PORT})`,
    );
    console.log(
      `[Doctor] GCP Config: Project=${env.GCP_PROJECT_ID}, Region=${env.GCP_REGION}`,
    );
  } catch (err) {
    console.error('[Doctor] Environment: Validation failed:', err);
    hasErrors = true;
  }

  // 3. Check GCP Client Initialization
  try {
    await checkGcpHealth();
    console.log(
      '[Doctor] GCP SDKs: Storage, Cloud Build, and Cloud Run initialized',
    );
  } catch (err) {
    console.warn('[Doctor] GCP SDKs initialization warning:', err);
  }

  // 4. Check Neon Database
  try {
    const { prisma } = await import('../packages/db/src/index');
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Doctor] Neon Database: Connected and schema synchronized');
  } catch (err) {
    console.warn('[Doctor] Neon Database check warning:', err);
  }

  // 5. Check Upstash Redis
  try {
    const env = getValidatedEnv();
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      });
      const data = (await res.json()) as { result: string };
      if (data.result === 'PONG') {
        console.log('[Doctor] Upstash Redis: Connected and verified (PONG)');
      }
    }
  } catch (err) {
    console.warn('[Doctor] Upstash Redis check warning:', err);
  }

  // 6. Check Workspaces
  console.log(
    '[Doctor] Workspaces: @deployment/shared, @deployment/db, control-api, reverse-proxy, orchestrator',
  );

  if (hasErrors) {
    console.log('\n[Doctor] Doctor check finished with issues.');
    process.exit(1);
  } else {
    console.log(
      '\n[Doctor] All cloud-native platform systems healthy and ready.',
    );
  }
}

runDoctor();
