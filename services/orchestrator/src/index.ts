import { getValidatedEnv } from '@deployment/shared';
import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { ServicesClient } from '@google-cloud/run';
import { Storage } from '@google-cloud/storage';

const env = getValidatedEnv();

let storageClient: Storage | null = null;
let cloudBuildClient: CloudBuildClient | null = null;
let cloudRunClient: ServicesClient | null = null;

export function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage({
      projectId: env.GCP_PROJECT_ID,
    });
  }
  return storageClient;
}

export function getCloudBuild(): CloudBuildClient {
  if (!cloudBuildClient) {
    cloudBuildClient = new CloudBuildClient({
      projectId: env.GCP_PROJECT_ID,
    });
  }
  return cloudBuildClient;
}

export function getCloudRun(): ServicesClient {
  if (!cloudRunClient) {
    cloudRunClient = new ServicesClient({
      projectId: env.GCP_PROJECT_ID,
    });
  }
  return cloudRunClient;
}

export async function checkGcpHealth(): Promise<boolean> {
  console.log(
    `☁️ GCP Orchestrator configured for Project: ${env.GCP_PROJECT_ID} (Region: ${env.GCP_REGION})`,
  );
  return true;
}

if (import.meta.main) {
  console.log('⚡ Initializing GCP Cloud-Native Orchestrator...');
  await checkGcpHealth();
}
