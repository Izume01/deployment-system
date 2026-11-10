import type { GitHubCommitMetadata, GitHubRepoInfo } from './types';

/**
 * Parses GitHub repository URL or shorthand (e.g. owner/repo).
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  const trimmed = url.trim();

  const httpsMatch = trimmed.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:[/]|$)/,
  );
  if (httpsMatch?.[1] && httpsMatch[2]) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  const sshMatch = trimmed.match(
    /git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
  );
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
 * Fetches latest commit SHA, commit message, author, and root directory file list
 * using GitHub REST API in ~50ms without cloning.
 */
export async function fetchGitHubCommit(
  owner: string,
  repo: string,
  ref = 'main',
  githubToken?: string,
): Promise<GitHubCommitMetadata> {
  const headers: Record<string, string> = {
    'User-Agent': 'paas-platform-agent',
    Accept: 'application/vnd.github.v3+json',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

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

  return {
    commitHash,
    commitMessage,
    author,
    rootFiles,
  };
}
