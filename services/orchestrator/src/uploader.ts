import { exec } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getValidatedEnv } from '@deployment/shared';
import { getStorage } from './index';

const execAsync = promisify(exec);
const env = getValidatedEnv();

export interface UploadSourceOptions {
  sourceDir: string;
  deploymentId: string;
  bucketName?: string;
}

export interface UploadResult {
  bucket: string;
  object: string;
  gcsUri: string;
}

/**
 * Ensures the target repository has a valid Dockerfile.
 * If not present, generates a standard, hardened production Dockerfile.
 */
async function ensureDockerfile(sourceDir: string): Promise<void> {
  const dockerfilePath = path.join(sourceDir, 'Dockerfile');
  if (existsSync(dockerfilePath)) {
    return;
  }

  // Node.js fallback
  if (existsSync(path.join(sourceDir, 'package.json'))) {
    console.log(
      '📦 [Uploader] No Dockerfile detected. Injecting production Node.js Dockerfile...',
    );
    const nodeDockerfile = `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
`.trim();
    await fs.writeFile(dockerfilePath, nodeDockerfile, 'utf-8');
    return;
  }

  // Python fallback
  if (existsSync(path.join(sourceDir, 'requirements.txt'))) {
    console.log(
      '🐍 [Uploader] No Dockerfile detected. Injecting production Python Dockerfile...',
    );
    const pythonDockerfile = `
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["python", "main.py"]
`.trim();
    await fs.writeFile(dockerfilePath, pythonDockerfile, 'utf-8');
    return;
  }
}

/**
 * Compresses source code into a tar.gz and uploads it to Google Cloud Storage.
 */
export async function uploadSourceToGCS(
  options: UploadSourceOptions,
): Promise<UploadResult> {
  const { sourceDir, deploymentId } = options;
  const bucketName = options.bucketName || env.GCP_SOURCE_BUCKET;

  // 1. Ensure Dockerfile exists
  await ensureDockerfile(sourceDir);

  // 2. Compress the source directory into an ephemeral tar.gz
  const archivePath = path.join(os.tmpdir(), `${deploymentId}.tar.gz`);
  console.log(`📦 [Uploader] Packaging ${sourceDir} -> ${archivePath}...`);

  try {
    await execAsync(
      `tar --exclude='.git' --exclude='node_modules' --exclude='.env' -czf "${archivePath}" -C "${sourceDir}" .`,
    );

    // 3. Upload to Google Cloud Storage
    const storage = getStorage();
    const destinationObject = `sources/${deploymentId}.tar.gz`;
    console.log(
      `☁️ [Uploader] Uploading to gs://${bucketName}/${destinationObject}...`,
    );

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
    console.log(`✅ [Uploader] Uploaded successfully: ${gcsUri}`);

    return {
      bucket: bucketName,
      object: destinationObject,
      gcsUri,
    };
  } finally {
    // 4. Clean up local tar.gz archive
    await fs.rm(archivePath, { force: true }).catch(() => {});
  }
}
