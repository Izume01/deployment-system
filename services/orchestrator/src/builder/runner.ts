import { getValidatedEnv } from '@deployment/shared';
import { getCloudBuild } from '../index';
import { generateBuildSteps } from './steps';
import type { BuildOptions, BuildResult } from './types';

const env = getValidatedEnv();

/**
 * Triggers a container build on Google Cloud Build.
 * Compiles the image in the cloud and pushes to Google Artifact Registry.
 */
export async function executeBuild(
  options: BuildOptions,
): Promise<BuildResult> {
  const {
    gcsBucket,
    gcsObject,
    projectSlug,
    deploymentId,
    hasDockerfile = true,
  } = options;

  const targetImage =
    options.customImageTag ||
    `${env.GCP_REGION}-docker.pkg.dev/${env.GCP_PROJECT_ID}/${env.GCP_ARTIFACT_REGISTRY}/${projectSlug}:${deploymentId}`;

  console.log(`[CloudBuild] Requesting build for ${targetImage}`);

  const steps = generateBuildSteps(hasDockerfile, targetImage);
  const cloudBuild = getCloudBuild();

  const [operation] = await cloudBuild.createBuild({
    projectId: env.GCP_PROJECT_ID,
    build: {
      source: {
        storageSource: {
          bucket: gcsBucket,
          object: gcsObject,
        },
      },
      steps,
      images: [targetImage],
      options: {
        logging: 'CLOUD_LOGGING_ONLY',
      },
    },
  });

  console.log(
    '[CloudBuild] Build initiated on Google Cloud servers. Waiting for completion...',
  );

  const [response] = await operation.promise();
  const status = response.status?.toString() || 'UNKNOWN';

  console.log(`[CloudBuild] Build finished with status: ${status}`);

  if (status !== 'SUCCESS') {
    throw new Error(
      `Google Cloud Build failed with status: ${status}. Logs: ${response.logUrl}`,
    );
  }

  return {
    imageTag: targetImage,
    buildId: response.id || deploymentId,
    status,
    logUrl: response.logUrl || undefined,
  };
}
