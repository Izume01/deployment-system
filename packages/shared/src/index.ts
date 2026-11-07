import { z } from 'zod';

export * from './env';

// ----------------------------------------------------
// Deployment Status Enum & Types
// ----------------------------------------------------
export const DeploymentStatusEnum = z.enum([
  'QUEUED',
  'BUILDING',
  'STARTING',
  'HEALTHY',
  'RUNNING',
  'FAILED',
  'STOPPED',
]);
export type DeploymentStatus = z.infer<typeof DeploymentStatusEnum>;

// ----------------------------------------------------
// Project Validation Schemas
// ----------------------------------------------------
export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  repoUrl: z.string().url('Must be a valid Git URL'),
  branch: z.string().default('main'),
  rootDirectory: z.string().default('./'),
  targetPort: z.number().int().default(3000),
  envVars: z.record(z.string()).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

// ----------------------------------------------------
// Reverse Proxy & Routing Types
// ----------------------------------------------------
export interface RouteEntry {
  slug: string;
  target: string; // e.g. http://172.18.0.5:3000 or http://localhost:49152
  containerId: string;
  isWarm: boolean;
  lastActiveAt: Date;
}

export interface RegisterRoutePayload {
  slug: string;
  target: string;
  containerId: string;
}

// ----------------------------------------------------
// Container Runtime Driver Interface
// ----------------------------------------------------
export interface ContainerConfig {
  projectId: string;
  deploymentId: string;
  imageTag: string;
  targetPort: number;
  envVars: Record<string, string>;
  memoryLimitBytes?: number; // default: 512MB
  nanoCpus?: number; // default: 1 CPU
}

export interface RunningContainer {
  containerId: string;
  ipAddress: string;
  port: number;
  targetAddress: string;
}

export interface ContainerStats {
  cpuPercentage: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
}
