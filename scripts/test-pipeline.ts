import { orchestrateDeployment } from '../services/orchestrator/src/index';

async function runPipelineTest() {
  const deploymentId = `dep-${Date.now()}`;
  console.log(`[Test] Starting deployment test: ${deploymentId}`);

  try {
    const result = await orchestrateDeployment({
      repoUrl: 'https://github.com/heroku/node-js-getting-started',
      branch: 'main',
      projectSlug: 'express-sample',
      deploymentId,
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
      console.log(`[Test] Probing ${result.serviceUrl}...`);
      const response = await fetch(result.serviceUrl);
      console.log(
        `[Test] HTTP Status: ${response.status} ${response.statusText}`,
      );
      const text = await response.text();
      console.log(`[Test] Response snippet:\n${text.slice(0, 200)}...\n`);
    }
  } catch (error) {
    console.error('[Test] Deployment pipeline failed:', error);
    process.exit(1);
  }
}

runPipelineTest();
