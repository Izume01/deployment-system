import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';

export interface CloneOptions {
  repoUrl: string;
  branch?: string;
  deploymentId: string;
  customTargetDir?: string;
}

export interface CloneResult {
  sourceDir: string;
  commitHash: string;
  commitMessage: string;
}

export async function cloneRepository(
  options: CloneOptions,
): Promise<CloneResult> {
  const { repoUrl, branch, deploymentId, customTargetDir } = options;

  const targetDir = customTargetDir
    ? path.join(customTargetDir, deploymentId)
    : path.join(process.env.TMPDIR || '/tmp', 'paas-builds', deploymentId);

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(path.dirname(targetDir), { recursive: true });

  const git = simpleGit({
    timeout: {
      block: 120000,
    },
  });

  const cloneArgs = ['--depth', '1'];
  if (branch) {
    cloneArgs.push('-b', branch);
  }

  await git.clone(repoUrl, targetDir, cloneArgs);

  const repoGit = simpleGit(targetDir);
  const log = await repoGit.log({ maxCount: 1 });

  return {
    sourceDir: targetDir,
    commitHash: log.latest?.hash ?? '',
    commitMessage: log.latest?.message ?? '',
  };
}

export async function cleanupBuildDir(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.warn(`⚠️ [Cloner] Failed to clean up ${dirPath}:`, err);
  }
}
