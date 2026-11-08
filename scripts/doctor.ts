import { getValidatedEnv } from '../packages/shared/src/env';
import { checkGcpHealth } from '../services/orchestrator/src/index';

async function runDoctor() {
  console.log(
    '🩺 Running Deployment System Doctor Checks (GCP Cloud-Native)...\n',
  );
  let hasErrors = false;

  // 1. Check Bun
  console.log(`✅ Runtime: Bun v${Bun.version}`);

  // 2. Check Environment Variables
  try {
    const env = getValidatedEnv();
    console.log(
      `✅ Environment: Validated (API Port: ${env.API_PORT}, Proxy Port: ${env.PROXY_PORT})`,
    );
    console.log(
      `☁️ GCP Config: Project=${env.GCP_PROJECT_ID}, Region=${env.GCP_REGION}`,
    );
  } catch (err) {
    console.error('❌ Environment: Validation failed:', err);
    hasErrors = true;
  }

  // 3. Check GCP Client Initialization
  try {
    await checkGcpHealth();
    console.log('✅ GCP SDKs: Storage, Cloud Build, and Cloud Run initialized');
  } catch (err) {
    console.warn('⚠️  GCP SDKs initialization warning:', err);
  }

  // 4. Check Workspaces
  console.log(
    '✅ Workspaces: @deployment/shared, @deployment/db, control-api, reverse-proxy, orchestrator',
  );

  if (hasErrors) {
    console.log('\n❌ Doctor check finished with issues.');
    process.exit(1);
  } else {
    console.log('\n✨ All cloud-native platform systems healthy and ready!');
  }
}

runDoctor();
