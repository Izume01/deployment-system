import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { getValidatedEnv } from '@deployment/shared';
import { getStorage } from './index';

const execAsync = promisify(exec);
const env = getValidatedEnv();

export type DetectedFramework =
  | 'dockerfile'
  | 'node'
  | 'python'
  | 'go'
  | 'unknown';

export interface RepoMetadata {
  commitHash: string;
  commitMessage: string;
  author: string;
  hasDockerfile: boolean;
  detectedFramework: DetectedFramework;
}

export interface StreamRepoOptions {
  repoUrl: string;
  branch?: string;
  deploymentId: string;
  bucketName?: string;
  githubToken?: string;
}

export interface UploadSourceOptions {
  sourceDir: string;
  deploymentId: string;
  bucketName?: string;
}

export interface UploadResult {
  bucket: string;
  object: string;
  gcsUri: string;
  metadata?: RepoMetadata;
}

/**
 * Extracts owner and repo name from GitHub URL or shorthand.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo
 */
export function parseGitHubUrl(
  url: string,
): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  const httpsMatch = trimmed.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/);
  if (httpsMatch?.[1] && httpsMatch[2]) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  const sshMatch = trimmed.match(/git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?/);
  if (sshMatch?.[1] && sshMatch[2]) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  const shorthandMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shorthandMatch?.[1] && shorthandMatch[2]) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2] };
  }

  return null;
}

/**
 * Inspects repository metadata (commit SHA, message, file tree) using GitHub API
 * without downloading repository source files.
 */
export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  ref = 'main',
  githubToken?: string,
): Promise<RepoMetadata> {
  const headers: Record<string, string> = {
    'User-Agent': 'paas-platform-agent',
    Accept: 'application/vnd.github.v3+json',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  // 1. Fetch commit details (try specified ref, fallback to 'master' if 404)
  let commitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${ref}`,
    { headers },
  );

  if (commitRes.status === 404 && ref === 'main') {
    commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/master`,
      { headers },
    );
  }

  if (!commitRes.ok) {
    throw new Error(
      `Failed to fetch commit metadata for ${owner}/${repo}@${ref}: ${commitRes.status} ${commitRes.statusText}`,
    );
  }

  const commitData = (await commitRes.json()) as {
    sha: string;
    commit: { message: string; author: { name: string } };
  };

  const commitHash = commitData.sha;
  const commitMessage = commitData.commit.message;
  const author = commitData.commit.author?.name || 'Unknown';

  // 2. Fetch root directory tree to detect Dockerfile / framework
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commitHash}`,
    { headers },
  );

  let rootFiles: string[] = [];
  if (treeRes.ok) {
    const treeData = (await treeRes.json()) as {
      tree?: Array<{ path: string; type: string }>;
    };
    rootFiles = (treeData.tree || []).map((t) => t.path);
  }

  const hasDockerfile = rootFiles.includes('Dockerfile');
  let detectedFramework: DetectedFramework = 'unknown';

  if (hasDockerfile) {
    detectedFramework = 'dockerfile';
  } else if (rootFiles.includes('package.json')) {
    detectedFramework = 'node';
  } else if (
    rootFiles.includes('requirements.txt') ||
    rootFiles.includes('pyproject.toml') ||
    rootFiles.includes('Pipfile')
  ) {
    detectedFramework = 'python';
  } else if (rootFiles.includes('go.mod')) {
    detectedFramework = 'go';
  }

  return {
    commitHash,
    commitMessage,
    author,
    hasDockerfile,
    detectedFramework,
  };
}

/**
 * Cloud-native source streamer:
 * Directly pipes GitHub's source tarball stream into Google Cloud Storage.
 * Zero local disk space used, zero git clone processes.
 */
export async function streamGitHubRepoToGCS(
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
  console.log(`🔍 [Uploader] Inspecting metadata for ${owner}/${repo}...`);

  const metadata = await fetchRepoMetadata(owner, repo, branch, githubToken);
  console.log(
    `📋 [Uploader] Commit: ${metadata.commitHash.slice(0, 7)} | Framework: ${metadata.detectedFramework} | Dockerfile: ${metadata.hasDockerfile}`,
  );

  const destinationObject = `sources/${deploymentId}.tar.gz`;
  const storage = getStorage();
  const file = storage.bucket(bucketName).file(destinationObject);

  console.log(
    `☁️ [Uploader] Streaming GitHub archive directly -> gs://${bucketName}/${destinationObject}...`,
  );

  const headers: Record<string, string> = {
    'User-Agent': 'paas-platform-agent',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const archiveUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${metadata.commitHash}`;
  const response = await fetch(archiveUrl, {
    headers,
    redirect: 'follow',
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download tarball from GitHub: ${response.status} ${response.statusText}`,
    );
  }

  // Pipe the web response stream directly to GCS WriteStream
  await pipeline(
    Readable.fromWeb(
      response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
    ),
    file.createWriteStream({
      contentType: 'application/gzip',
      metadata: {
        deploymentId,
        commitHash: metadata.commitHash,
        commitMessage: metadata.commitMessage,
        author: metadata.author,
        detectedFramework: metadata.detectedFramework,
        uploadedAt: new Date().toISOString(),
      },
    }),
  );

  const gcsUri = `gs://${bucketName}/${destinationObject}`;
  console.log(`✅ [Uploader] Streamed successfully: ${gcsUri}`);

  return {
    bucket: bucketName,
    object: destinationObject,
    gcsUri,
    metadata,
  };
}

/**
 * Fallback uploader for local directories or offline testing.
 */
export async function uploadLocalDirToGCS(
  options: UploadSourceOptions,
): Promise<UploadResult> {
  const { sourceDir, deploymentId } = options;
  const bucketName = options.bucketName || env.GCP_SOURCE_BUCKET;

  const archivePath = path.join(os.tmpdir(), `${deploymentId}.tar.gz`);
  console.log(
    `📦 [Uploader] Packaging local ${sourceDir} -> ${archivePath}...`,
  );

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
