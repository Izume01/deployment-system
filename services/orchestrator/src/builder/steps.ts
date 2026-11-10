import type { CloudBuildStep } from './types';

/**
 * Constructs Cloud Build steps.
 * Step 0: Flattens outer directory created by GitHub archive extracts.
 * Step 1:
 *  - If custom Dockerfile: builds directly using docker.
 *  - If zero-config: builds and publishes via Google Cloud Native Buildpack (pack CLI).
 */
export function generateBuildSteps(
  hasDockerfile: boolean,
  targetImage: string,
  synthesizedDockerfile?: string,
): CloudBuildStep[] {
  const steps: CloudBuildStep[] = [
    {
      name: 'bash',
      args: [
        '-c',
        'shopt -s dotglob; SUBDIR=$$(find . -maxdepth 1 -mindepth 1 -type d); if [ $$(echo "$$SUBDIR" | wc -l) -eq 1 ] && [ ! -f package.json ] && [ ! -f Dockerfile ] && [ -n "$$SUBDIR" ]; then mv $$SUBDIR/* . && rm -rf $$SUBDIR; fi; if [ -f pnpm-lock.yaml ]; then echo "strict-dep-builds=false" >> .npmrc; echo "ignore-scripts=false" >> .npmrc; fi',
      ],
    },
  ];

  if (hasDockerfile) {
    steps.push({
      name: 'gcr.io/cloud-builders/docker',
      args: ['build', '-t', targetImage, '.'],
    });
    return steps;
  }

  if (synthesizedDockerfile) {
    const encoded = Buffer.from(synthesizedDockerfile).toString('base64');
    steps[0].args = [
      '-c',
      `${steps[0].args[1]}; echo "${encoded}" | base64 -d > Dockerfile`,
    ];
    steps.push({
      name: 'gcr.io/cloud-builders/docker',
      args: ['build', '-t', targetImage, '.'],
    });
    return steps;
  }

  steps.push({
    name: 'gcr.io/k8s-skaffold/pack',
    entrypoint: 'pack',
    args: [
      'build',
      targetImage,
      '--builder',
      'gcr.io/buildpacks/builder:google-22',
      '--network',
      'cloudbuild',
      '--publish',
    ],
  });

  return steps;
}
