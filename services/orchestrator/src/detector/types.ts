export type RuntimeLanguage =
  | 'dockerfile'
  | 'nextjs'
  | 'static-spa'
  | 'node-api'
  | 'python'
  | 'go'
  | 'rust'
  | 'bun'
  | 'deno'
  | 'unknown';

export type DeploymentTarget = 'cloud-run' | 'static-gcs' | 'custom-docker';

export interface PackageManifest {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DetectionResult {
  language: RuntimeLanguage;
  target: DeploymentTarget;
  hasDockerfile: boolean;
  framework?: string;
  buildCommand?: string;
  startCommand?: string;
  outputDir?: string;
  confidence: number;
}
