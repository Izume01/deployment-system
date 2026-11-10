import { analyzePackageJson } from './package-analyzer';
import { LANGUAGE_RULES, matchesAnyFile } from './rules';
import type { DetectionResult, PackageManifest } from './types';

export * from './types';
export * from './package-analyzer';
export * from './rules';

export interface DetectionOptions {
  files: string[];
  packageManifest?: PackageManifest | null;
}

/**
 * Detects the runtime language, framework, and deployment target for a repository.
 *
 * 1. Custom Dockerfile present? Skip framework detection entirely.
 * 2. package.json present? Inspect dependencies:
 *    - next -> Next.js (Cloud Run)
 *    - vite / react-scripts -> Static SPA (GCS)
 *    - express / fastify / etc -> Node API (Cloud Run)
 * 3. requirements.txt / pyproject.toml -> Python (Cloud Run)
 * 4. go.mod -> Go (Cloud Run)
 * 5. Cargo.toml -> Rust (Cloud Run)
 */
export function detectRuntime(options: DetectionOptions): DetectionResult {
  const { files, packageManifest } = options;

  // 1. Dockerfile has top priority. If user supplied it, respect it without guessing.
  if (files.includes('Dockerfile')) {
    return {
      language: 'dockerfile',
      target: 'custom-docker',
      hasDockerfile: true,
      confidence: 1.0,
    };
  }

  // 2. Bun ecosystem detection (bun.lock or bun.lockb)
  if (files.includes('bun.lockb') || files.includes('bun.lock')) {
    return {
      language: 'bun',
      target: 'cloud-run',
      hasDockerfile: false,
      buildCommand: 'bun install',
      startCommand: 'bun run start',
      confidence: 0.95,
    };
  }

  // 3. Node ecosystem detection
  if (files.includes('package.json')) {
    if (packageManifest) {
      return analyzePackageJson(packageManifest);
    }
    // Basic fallback if package.json exists but manifest content wasn't loaded
    return {
      language: 'node-api',
      target: 'cloud-run',
      hasDockerfile: false,
      framework: 'node',
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      confidence: 0.6,
    };
  }

  // 3. Match against language signatures (Python, Go, Rust)
  for (const rule of LANGUAGE_RULES) {
    if (matchesAnyFile(files, rule.files)) {
      return {
        language: rule.language,
        target: rule.target,
        hasDockerfile: false,
        buildCommand: rule.buildCommand,
        startCommand: rule.startCommand,
        confidence: rule.confidence,
      };
    }
  }

  // 4. Unknown fallback
  return {
    language: 'unknown',
    target: 'cloud-run',
    hasDockerfile: false,
    confidence: 0,
  };
}
