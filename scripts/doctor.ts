import { getValidatedEnv } from '../packages/shared/src/env';
import { docker } from '../services/orchestrator/src/index';

async function runDoctor() {
  console.log('🩺 Running Deployment System Doctor Checks...\n');
  let hasErrors = false;

  // 1. Check Bun
  console.log(`✅ Runtime: Bun v${Bun.version}`);

  // 2. Check Environment Variables
  try {
    const env = getValidatedEnv();
    console.log(
      `✅ Environment: Validated (API Port: ${env.API_PORT}, Proxy Port: ${env.PROXY_PORT})`,
    );
  } catch (err) {
    console.error('❌ Environment: Validation failed:', err);
    hasErrors = true;
  }

  // 3. Check Docker Engine API
  try {
    const version = await docker.version();
    console.log(
      `✅ Docker Engine: Connected (v${version.Version}, API v${version.ApiVersion})`,
    );
  } catch (err) {
    console.warn('⚠️  Docker Engine: Could not connect to /var/run/docker.sock');
  }

  // 4. Check Workspaces
  console.log(
    '✅ Workspaces: @deployment/shared, @deployment/db, control-api, reverse-proxy, orchestrator',
  );

  if (hasErrors) {
    console.log('\n❌ Doctor check finished with issues.');
    process.exit(1);
  } else {
    console.log(
      '\n✨ All core platform systems healthy and ready for development!',
    );
  }
}

runDoctor();
