import { getValidatedEnv } from '@deployment/shared';
import { getCloudBuild } from './index';
import type { DetectedFramework } from './uploader';

const env = getValidatedEnv();

export interface BuildOptions {
  gcsBucket: string;
  gcsObject: string;
  projectSlug: string;
  deploymentId: string;
  hasDockerfile?: boolean;
  detectedFramework?: DetectedFramework;
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
 * If no Dockerfile was provided in the repository, injects a hardened
 * multi-stage Dockerfile step in the build environment before compiling.
 */
export async function triggerCloudBuild(
  options: BuildOptions,
): Promise<BuildResult> {
  const {
    gcsBucket,
    gcsObject,
    projectSlug,
    deploymentId,
    hasDockerfile = true,
    detectedFramework,
  } = options;

  // Destination image in Google Artifact Registry
  const targetImage =
    options.customImageTag ||
    `${env.GCP_REGION}-docker.pkg.dev/${env.GCP_PROJECT_ID}/${env.GCP_ARTIFACT_REGISTRY}/${projectSlug}:${deploymentId}`;

  console.log(`🔨 [CloudBuild] Requesting build for ${targetImage}...`);

  const steps: Array<{ name: string; args: string[] }> = [];

  // If repo has no Dockerfile, inject an auto-generated Dockerfile step inside Cloud Build
  if (!hasDockerfile) {
    if (detectedFramework === 'node') {
      console.log(
        '📦 [CloudBuild] Injecting auto-generated Node.js Dockerfile step...',
      );
      steps.push({
        name: 'bash',
        args: [
          '-c',
          `cat << 'EOF' > Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
EOF`,
        ],
      });
    } else if (detectedFramework === 'python') {
      console.log(
        '🐍 [CloudBuild] Injecting auto-generated Python Dockerfile step...',
      );
      steps.push({
        name: 'bash',
        args: [
          '-c',
          `cat << 'EOF' > Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt* pyproject.toml* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["python", "main.py"]
EOF`,
        ],
      });
    } else if (detectedFramework === 'go') {
      console.log(
        '🐹 [CloudBuild] Injecting auto-generated Go Dockerfile step...',
      );
      steps.push({
        name: 'bash',
        args: [
          '-c',
          `cat << 'EOF' > Dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .
FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/server .
ENV PORT=8080
EXPOSE 8080
CMD ["./server"]
EOF`,
        ],
      });
    }
  }

  // Docker build step
  steps.push({
    name: 'gcr.io/cloud-builders/docker',
    args: ['build', '-t', targetImage, '.'],
  });

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
      steps,
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
