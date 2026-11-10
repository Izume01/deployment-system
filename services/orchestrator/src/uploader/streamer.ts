import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getValidatedEnv } from '@deployment/shared';
import { detectRuntime } from '../detector';
import { getStorage } from '../index';
import { fetchGitHubCommit, parseGitHubUrl } from './github';
import type { StreamRepoOptions, UploadResult } from './types';

const env = getValidatedEnv();

/**
 * Cloud-native direct streamer:
 * Streams GitHub's source tarball stream directly into Google Cloud Storage.
 * Zero local disk space used, zero git clone child processes.
 */
export async function streamGitHubTarball(
  options: StreamRepoOptions,
): Promise<UploadResult> {
  const { repoUrl, branch = 'main', deploymentId, githubToken } = options;
  const bucketName = options.bucketName || env.GCP_SOURCE_BUCKET;

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error(
      `Invalid GitHub repository URL: "${repoUrl}". Expected format: https://github.com/owner/repo`,
    );
  }

  const { owner, repo } = parsed;
  console.log(`[Uploader] Inspecting metadata for ${owner}/${repo}`);

  const commitMeta = await fetchGitHubCommit(owner, repo, branch, githubToken);
  const detection = detectRuntime({ files: commitMeta.rootFiles });

  console.log(
    `[Uploader] Commit: ${commitMeta.commitHash.slice(0, 7)} | Framework: ${detection.language} | Dockerfile: ${detection.hasDockerfile}`,
  );

  const destinationObject = `sources/${deploymentId}.tar.gz`;
  const storage = getStorage();
  const file = storage.bucket(bucketName).file(destinationObject);

  console.log(
    `[Uploader] Streaming GitHub archive directly -> gs://${bucketName}/${destinationObject}`,
  );

  const headers: Record<string, string> = {
    'User-Agent': 'paas-platform-agent',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const archiveUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${commitMeta.commitHash}`;
  const response = await fetch(archiveUrl, {
    headers,
    redirect: 'follow',
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download tarball from GitHub: ${response.status} ${response.statusText}`,
    );
  }

  await pipeline(
    Readable.fromWeb(
      response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
    ),
    file.createWriteStream({
      contentType: 'application/gzip',
      metadata: {
        deploymentId,
        commitHash: commitMeta.commitHash,
        commitMessage: commitMeta.commitMessage,
        author: commitMeta.author,
        language: detection.language,
        target: detection.target,
        uploadedAt: new Date().toISOString(),
      },
    }),
  );

  const gcsUri = `gs://${bucketName}/${destinationObject}`;
  console.log(`[Uploader] Streamed successfully: ${gcsUri}`);

  return {
    bucket: bucketName,
    object: destinationObject,
    gcsUri,
    detection,
    commitHash: commitMeta.commitHash,
    commitMessage: commitMeta.commitMessage,
    author: commitMeta.author,
  };
}
