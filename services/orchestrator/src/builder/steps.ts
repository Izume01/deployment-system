import type { CloudBuildStep } from './types';

/**
 * Constructs Cloud Build steps.
 * If repository has custom Dockerfile: builds directly with docker.
 * If zero-config repository: uses Railway Nixpacks builder to generate
 * an optimized multi-stage Dockerfile, then builds with docker.
 */
export function generateBuildSteps(
  hasDockerfile: boolean,
  targetImage: string,
): CloudBuildStep[] {
  if (hasDockerfile) {
    return [
      {
        name: 'gcr.io/cloud-builders/docker',
        args: ['build', '-t', targetImage, '.'],
      },
    ];
  }

  return [
    {
      name: 'ghcr.io/railwayapp/nixpacks:latest',
      args: ['build', '.', '--out', '.nixpacks'],
    },
    {
      name: 'gcr.io/cloud-builders/docker',
      args: ['build', '-f', '.nixpacks/Dockerfile', '-t', targetImage, '.'],
    },
  ];
}
