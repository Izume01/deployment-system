import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getValidatedEnv } from '@deployment/shared';
import { getStorage } from '../index';
import type { UploadResult, UploadSourceOptions } from './types';

const execAsync = promisify(exec);
const env = getValidatedEnv();

/**
 * Fallback uploader for local directories or offline testing.
 * Packages local directory into a temporary tar.gz and uploads to GCS.
 */
export async function uploadLocalDirectory(
  options: UploadSourceOptions,
): Promise<UploadResult> {
  const { sourceDir, deploymentId } = options;
  const bucketName = options.bucketName || env.GCP_SOURCE_BUCKET;

  const archivePath = path.join(os.tmpdir(), `${deploymentId}.tar.gz`);
  console.log(`[Uploader] Packaging local ${sourceDir} -> ${archivePath}`);

  try {
    await execAsync(
      `tar --exclude='.git' --exclude='node_modules' --exclude='.env' -czf "${archivePath}" -C "${sourceDir}" .`,
    );

    const storage = getStorage();
    const destinationObject = `sources/${deploymentId}.tar.gz`;

    await storage.bucket(bucketName).upload(archivePath, {
      destination: destinationObject,
      metadata: {
        contentType: 'application/gzip',
        metadata: {
          deploymentId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const gcsUri = `gs://${bucketName}/${destinationObject}`;
    return {
      bucket: bucketName,
      object: destinationObject,
      gcsUri,
    };
  } finally {
    await fs.rm(archivePath, { force: true }).catch(() => {});
  }
}
