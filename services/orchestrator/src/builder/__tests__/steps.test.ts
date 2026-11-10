import { describe, expect, it } from 'bun:test';
import { generateBuildSteps } from '../steps';

describe('Cloud Build Steps Generator (Railway Nixpacks Pattern)', () => {
  const targetImage = 'us-central1-docker.pkg.dev/proj/apps/my-app:123';

  it('should generate direct docker step when custom Dockerfile is present', () => {
    const steps = generateBuildSteps(true, targetImage);

    expect(steps.length).toBe(1);
    expect(steps[0].name).toBe('gcr.io/cloud-builders/docker');
    expect(steps[0].args).toEqual(['build', '-t', targetImage, '.']);
  });

  it('should generate Railway Nixpacks builder step when Dockerfile is absent', () => {
    const steps = generateBuildSteps(false, targetImage);

    expect(steps.length).toBe(2);
    expect(steps[0].name).toBe('ghcr.io/railwayapp/nixpacks:latest');
    expect(steps[0].args).toEqual(['build', '.', '--out', '.nixpacks']);

    expect(steps[1].name).toBe('gcr.io/cloud-builders/docker');
    expect(steps[1].args).toEqual([
      'build',
      '-f',
      '.nixpacks/Dockerfile',
      '-t',
      targetImage,
      '.',
    ]);
  });
});
