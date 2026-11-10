import { getValidatedEnv } from '@deployment/shared';
import { getCloudBuild } from './index';

const env = getValidatedEnv();

export interface BuildOptions {
  gcsBucket: string;
  gcsObject: string;
  projectSlug: string;
  deploymentId: string;
  customImageTag?: string;
}

export interface BuildResult {
  imageTag: string;
  buildId: string;
  status: string;
  logUrl?: string;
  durationSeconds?: number;
}

/**
 * Triggers a container build on Google Cloud Build from a GCS source archive.
 * Compiles the image in the cloud and pushes to Google Artifact Registry.
 */
export async function triggerCloudBuild(
  options: BuildOptions,
): Promise<BuildResult> {
  const { gcsBucket, gcsObject, projectSlug, deploymentId } = options;

  // Destination image in Google Artifact Registry
  const targetImage =
    options.customImageTag ||
    `${env.GCP_REGION}-docker.pkg.dev/${env.GCP_PROJECT_ID}/${env.GCP_ARTIFACT_REGISTRY}/${projectSlug}:${deploymentId}`;

  console.log(`🔨 [CloudBuild] Requesting build for ${targetImage}...`);

  const cloudBuild = getCloudBuild();

  // 1. Submit the build request to Google Cloud Build
  const [operation] = await cloudBuild.createBuild({
    projectId: env.GCP_PROJECT_ID,
    build: {
      source: {
        storageSource: {
          bucket: gcsBucket,
          object: gcsObject,
        },
      },
      steps: [
        {
          name: 'gcr.io/cloud-builders/docker',
          args: ['build', '-t', targetImage, '.'],
        },
      ],
      images: [targetImage],
      options: {
        logging: 'CLOUD_LOGGING_ONLY',
      },
    },
  });

  console.log(
    '⏳ [CloudBuild] Build initiated on Google Cloud servers. Waiting for completion...',
  );

  // 2. Wait for Google Cloud Build to complete
  const [response] = await operation.promise();

  const status = response.status?.toString() || 'UNKNOWN';
  console.log(`🏁 [CloudBuild] Build finished with status: ${status}`);

  if (status !== 'SUCCESS') {
    throw new Error(
      `Google Cloud Build failed with status: ${status}. Check logs: ${response.logUrl}`,
    );
  }

  return {
    imageTag: targetImage,
    buildId: response.id || deploymentId,
    status,
    logUrl: response.logUrl || undefined,
  };
}
