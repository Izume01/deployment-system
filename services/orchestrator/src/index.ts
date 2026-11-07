import { getValidatedEnv } from '@deployment/shared';
import Docker from 'dockerode';

const env = getValidatedEnv();
export const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function checkDockerHealth(): Promise<boolean> {
  try {
    const version = await docker.version();
    console.log(`🐳 Connected to Docker Engine v${version.Version}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Docker daemon:', error);
    return false;
  }
}

if (import.meta.main) {
  console.log('⚡ Initializing Orchestration Engine...');
  await checkDockerHealth();
}
