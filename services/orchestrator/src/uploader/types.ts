import type { DetectionResult } from '../detector';

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
  detection?: DetectionResult;
  commitHash?: string;
  commitMessage?: string;
  author?: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

export interface GitHubCommitMetadata {
  commitHash: string;
  commitMessage: string;
  author: string;
  rootFiles: string[];
}
