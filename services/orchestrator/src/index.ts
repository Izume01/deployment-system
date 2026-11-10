import { executeBuild } from './builder';
import { checkGcpHealth } from './clients';
import { streamGitHubTarball } from './uploader';

export * from './clients';
export * from './uploader';
export * from './builder';
export * from './detector';
export * from './cloner';

export interface OrchestrateDeploymentOptions {
  repoUrl: string;
  branch?: string;
  projectSlug: string;
  deploymentId: string;
  githubToken?: string;
}

export interface OrchestrationResult {
  deploymentId: string;
  projectSlug: string;
  imageTag: string;
  buildId: string;
  commitHash?: string;
  author?: string;
  detectedLanguage: string;
  target: string;
  durationMs: number;
}

/**
 * End-to-end deployment pipeline:
 * 1. Inspects repository & streams source tarball directly to GCS (Zero local disk).
 * 2. Compiles container image via Google Cloud Build using Nixpacks / custom Dockerfile.
 */
export async function orchestrateDeployment(
  options: OrchestrateDeploymentOptions,
): Promise<OrchestrationResult> {
  const startTime = Date.now();
  const {
    repoUrl,
    branch = 'main',
    projectSlug,
    deploymentId,
    githubToken,
  } = options;

  console.log(
    `[Orchestrator] Starting deployment pipeline for ${projectSlug} (${deploymentId})`,
  );

  // 1. Stream GitHub archive directly to GCS with framework detection
  const uploadResult = await streamGitHubTarball({
    repoUrl,
    branch,
    deploymentId,
    githubToken,
  });

  const hasDockerfile = uploadResult.detection?.hasDockerfile ?? true;

  // 2. Trigger Google Cloud Build
  const buildResult = await executeBuild({
    gcsBucket: uploadResult.bucket,
    gcsObject: uploadResult.object,
    projectSlug,
    deploymentId,
    hasDockerfile,
  });

  const durationMs = Date.now() - startTime;
  console.log(
    `[Orchestrator] Build completed in ${(durationMs / 1000).toFixed(1)}s: ${buildResult.imageTag}`,
  );

  return {
    deploymentId,
    projectSlug,
    imageTag: buildResult.imageTag,
    buildId: buildResult.buildId,
    commitHash: uploadResult.commitHash,
    author: uploadResult.author,
    detectedLanguage: uploadResult.detection?.language || 'unknown',
    target: uploadResult.detection?.target || 'cloud-run',
    durationMs,
  };
}

if (import.meta.main) {
  console.log('[Orchestrator] Service initialized.');
  await checkGcpHealth();
}
