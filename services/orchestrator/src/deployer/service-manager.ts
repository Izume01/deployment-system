import { getValidatedEnv } from '@deployment/shared';
import { getCloudRun } from '../clients';
import type { DeployOptions, DeployResult } from './types';

const env = getValidatedEnv();

/**
 * Sanitizes service name to comply with Cloud Run naming conventions:
 * Lowercase letters, numbers, and hyphens. Max 63 characters.
 */
export function sanitizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

/**
 * Deploys an Artifact Registry container image to Google Cloud Run with scale-to-zero.
 * Automatically configures public HTTPS access.
 */
export async function deployToCloudRun(
  options: DeployOptions,
): Promise<DeployResult> {
  const {
    imageTag,
    deploymentId,
    port = 8080,
    envVars = {},
    cpu = '1000m',
    memory = '512Mi',
    minInstances = 0,
    maxInstances = 10,
  } = options;

  const serviceName = sanitizeServiceName(options.serviceName);
  const client = getCloudRun();
  const parent = `projects/${env.GCP_PROJECT_ID}/locations/${env.GCP_REGION}`;
  const servicePath = `${parent}/services/${serviceName}`;

  console.log(`[Deployer] Preparing Cloud Run deployment for ${serviceName}`);

  const formattedEnv = Object.entries(envVars)
    .filter(([name]) => name.toUpperCase() !== 'PORT')
    .map(([name, value]) => ({
      name,
      value,
    }));

  const serviceConfig = {
    template: {
      containers: [
        {
          image: imageTag,
          ports: [{ containerPort: port }],
          resources: {
            limits: { cpu, memory },
          },
          env: [
            ...formattedEnv,
            { name: 'DEPLOYMENT_ID', value: deploymentId },
          ],
        },
      ],
      scaling: {
        minInstanceCount: minInstances,
        maxInstanceCount: maxInstances,
      },
    },
  };

  let isExisting = false;
  try {
    await client.getService({ name: servicePath });
    isExisting = true;
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code !== 5) {
      throw err;
    }
  }

  let serviceUri = '';
  let revisionName = '';

  if (isExisting) {
    console.log(`[Deployer] Updating existing service: ${serviceName}`);
    const [operation] = await client.updateService({
      service: {
        name: servicePath,
        ...serviceConfig,
      },
    });
    const [service] = await operation.promise();
    serviceUri = service.uri || '';
    revisionName = service.latestCreatedRevision || '';
  } else {
    console.log(`[Deployer] Creating new Cloud Run service: ${serviceName}`);
    const [operation] = await client.createService({
      parent,
      serviceId: serviceName,
      service: serviceConfig,
    });
    const [service] = await operation.promise();
    serviceUri = service.uri || '';
    revisionName = service.latestCreatedRevision || '';
  }

  // Grant public invoker access (allUsers)
  console.log(`[Deployer] Configuring public HTTPS access for ${serviceName}`);
  try {
    await client.setIamPolicy({
      resource: servicePath,
      policy: {
        bindings: [
          {
            role: 'roles/run.invoker',
            members: ['allUsers'],
          },
        ],
      },
    });
  } catch (iamErr) {
    console.warn(
      '[Deployer] Warning: Failed to set public IAM policy:',
      iamErr,
    );
  }

  console.log(`[Deployer] Live URL: ${serviceUri}`);

  return {
    serviceName,
    serviceUrl: serviceUri,
    latestRevisionName: revisionName,
    deploymentId,
    status: 'READY',
  };
}
