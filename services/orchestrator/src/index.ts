import { executeBuild } from './builder';
import { checkGcpHealth } from './clients';
import { deployToCloudRun } from './deployer';
import { getDockerfileTemplate } from './templates';
import { streamGitHubTarball } from './uploader/streamer';

export * from './clients';
export * from './uploader';
export * from './builder';
export * from './detector';
export * from './cloner';
export * from './deployer';
export * from './templates';

export interface OrchestrateDeploymentOptions {
  repoUrl: string;
  branch?: string;
  projectSlug: string;
  deploymentId: string;
  githubToken?: string;
  envVars?: Record<string, string>;
  useLeanTemplate?: boolean;
}

export interface OrchestrationResult {
  deploymentId: string;
  projectSlug: string;
  imageTag: string;
  buildId: string;
  serviceUrl?: string;
  commitHash?: string;
  author?: string;
  detectedLanguage: string;
  target: string;
  durationMs: number;
}

/**
 * End-to-end deployment pipeline:
 * 1. Inspects repository & streams source tarball directly to GCS (Zero local disk).
 * 2. Compiles container image via Google Cloud Build using Buildpacks / custom Dockerfile.
 * 3. Deploys container image to Google Cloud Run with scale-to-zero and public HTTPS URL.
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
    envVars,
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
  const detectedLanguage = uploadResult.detection?.language || '';

  // Auto-synthesize Dockerfile for unsupported buildpack runtimes (e.g. Rust, Bun, Deno) or when requested
  let synthesizedDockerfile: string | undefined;
  if (!hasDockerfile) {
    if (
      detectedLanguage === 'rust' ||
      detectedLanguage === 'bun' ||
      detectedLanguage === 'deno' ||
      options.useLeanTemplate
    ) {
      synthesizedDockerfile =
        getDockerfileTemplate(detectedLanguage) ?? undefined;
      if (synthesizedDockerfile) {
        console.log(
          `[Orchestrator] Synthesizing lean multi-stage Dockerfile for ${detectedLanguage}`,
        );
      }
    }
  }

  // 2. Trigger Google Cloud Build
  const buildResult = await executeBuild({
    gcsBucket: uploadResult.bucket,
    gcsObject: uploadResult.object,
    projectSlug,
    deploymentId,
    hasDockerfile,
    synthesizedDockerfile,
  });

  // 3. Deploy container service to Google Cloud Run
  let serviceUrl: string | undefined;
  if (uploadResult.detection?.target !== 'static-gcs') {
    const deployResult = await deployToCloudRun({
      imageTag: buildResult.imageTag,
      serviceName: projectSlug,
      deploymentId,
      envVars,
    });
    serviceUrl = deployResult.serviceUrl;
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[Orchestrator] Pipeline finished in ${(durationMs / 1000).toFixed(1)}s. URL: ${serviceUrl || 'N/A'}`,
  );

  return {
    deploymentId,
    projectSlug,
    imageTag: buildResult.imageTag,
    buildId: buildResult.buildId,
    serviceUrl,
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
