export interface BuildOptions {
  gcsBucket: string;
  gcsObject: string;
  projectSlug: string;
  deploymentId: string;
  hasDockerfile?: boolean;
  customImageTag?: string;
}

export interface BuildResult {
  imageTag: string;
  buildId: string;
  status: string;
  logUrl?: string;
  durationSeconds?: number;
}

export interface CloudBuildStep {
  name: string;
  args: string[];
  entrypoint?: string;
}
