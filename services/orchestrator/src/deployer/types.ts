export interface DeployOptions {
  imageTag: string;
  serviceName: string;
  deploymentId: string;
  port?: number;
  envVars?: Record<string, string>;
  cpu?: string;
  memory?: string;
  minInstances?: number;
  maxInstances?: number;
}

export interface DeployResult {
  serviceName: string;
  serviceUrl: string;
  latestRevisionName?: string;
  deploymentId: string;
  status: string;
}
