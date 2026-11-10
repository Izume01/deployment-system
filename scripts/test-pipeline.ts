import { orchestrateDeployment } from '../services/orchestrator/src/index';

async function runPipelineTest() {
  const deploymentId = `dep-${Date.now()}`;
  console.log(`[Test] Starting deployment test: ${deploymentId}`);

  try {
    const result = await orchestrateDeployment({
      repoUrl: 'https://github.com/alexellis/expressjs-docker',
      branch: 'master',
      projectSlug: 'dockerfile-sample',
      deploymentId,
      envVars: {
        NODE_ENV: 'production',
        http_port: '8080',
      },
    });

    console.log('[Test] Deployment succeeded!');
    console.log(`[Test] Project: ${result.projectSlug}`);
    console.log(`[Test] Image: ${result.imageTag}`);
    console.log(`[Test] Build ID: ${result.buildId}`);
    console.log(`[Test] Live Service URL: ${result.serviceUrl || 'N/A'}`);
    console.log(
      `[Test] Total Duration: ${(result.durationMs / 1000).toFixed(1)}s`,
    );

    if (result.serviceUrl) {
      console.log(`[Test] Probing ${result.serviceUrl}/health...`);
      const response = await fetch(`${result.serviceUrl}/health`);
      console.log(
        `[Test] HTTP Status: ${response.status} ${response.statusText}`,
      );
      const text = await response.text();
      console.log(`[Test] Response: ${text.trim()}\n`);
    }
  } catch (error) {
    console.error('[Test] Deployment pipeline failed:', error);
    process.exit(1);
  }
}

runPipelineTest();
