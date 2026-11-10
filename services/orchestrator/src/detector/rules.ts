import type { DetectionResult } from './types';

export interface FileDetectionRule {
  language: DetectionResult['language'];
  target: DetectionResult['target'];
  files: string[];
  buildCommand?: string;
  startCommand?: string;
  confidence: number;
}

/**
 * Ordered language detection rules inspired by Nixpacks.
 * Evaluated against repository root file lists.
 */
export const LANGUAGE_RULES: FileDetectionRule[] = [
  {
    language: 'python',
    target: 'cloud-run',
    files: ['requirements.txt', 'pyproject.toml', 'Pipfile'],
    buildCommand: 'pip install --no-cache-dir -r requirements.txt',
    startCommand: 'python main.py',
    confidence: 0.85,
  },
  {
    language: 'go',
    target: 'cloud-run',
    files: ['go.mod'],
    buildCommand: 'go build -o server .',
    startCommand: './server',
    confidence: 0.9,
  },
  {
    language: 'rust',
    target: 'cloud-run',
    files: ['Cargo.toml'],
    buildCommand: 'cargo build --release',
    startCommand: './target/release/app',
    confidence: 0.9,
  },
];

export function matchesAnyFile(
  repoFiles: string[],
  ruleFiles: string[],
): boolean {
  return ruleFiles.some((rf) => repoFiles.includes(rf));
}
