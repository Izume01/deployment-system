import { describe, expect, it } from 'bun:test';
import { generateBuildSteps } from '../steps';

describe('Cloud Build Steps Generator (Cloud Native Buildpack Pattern)', () => {
  const targetImage = 'us-central1-docker.pkg.dev/proj/apps/my-app:123';

  it('should generate flatten step + direct docker step when custom Dockerfile is present', () => {
    const steps = generateBuildSteps(true, targetImage);

    expect(steps.length).toBe(2);
    expect(steps[0].name).toBe('bash');
    expect(steps[1].name).toBe('gcr.io/cloud-builders/docker');
    expect(steps[1].args).toEqual(['build', '-t', targetImage, '.']);
  });

  it('should generate flatten step + pack build step when Dockerfile is absent', () => {
    const steps = generateBuildSteps(false, targetImage);

    expect(steps.length).toBe(2);
    expect(steps[0].name).toBe('bash');
    expect(steps[1].name).toBe('gcr.io/k8s-skaffold/pack');
    expect(steps[1].entrypoint).toBe('pack');
    expect(steps[1].args).toEqual([
      'build',
      targetImage,
      '--builder',
      'gcr.io/buildpacks/builder:google-22',
      '--network',
      'cloudbuild',
      '--publish',
    ]);
  });

  it('should generate flatten step with injected Dockerfile + direct docker step when synthesizedDockerfile is provided', () => {
    const synthesized = 'FROM alpine:latest\nCMD ["echo", "test"]';
    const steps = generateBuildSteps(false, targetImage, synthesized);

    expect(steps.length).toBe(2);
    expect(steps[0].name).toBe('bash');
    expect(steps[0].args[1]).toContain('base64 -d > Dockerfile');
    expect(steps[1].name).toBe('gcr.io/cloud-builders/docker');
    expect(steps[1].args).toEqual(['build', '-t', targetImage, '.']);
  });
});
