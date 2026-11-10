import { describe, expect, it } from 'bun:test';
import { detectRuntime } from '../index';

describe('Runtime & Framework Detector', () => {
  it('should prioritize custom Dockerfile and skip framework detection', () => {
    const result = detectRuntime({
      files: ['Dockerfile', 'package.json', 'main.py'],
      packageManifest: { dependencies: { next: '14.0.0' } },
    });

    expect(result.language).toBe('dockerfile');
    expect(result.target).toBe('custom-docker');
    expect(result.hasDockerfile).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it('should detect Next.js with Cloud Run target', () => {
    const result = detectRuntime({
      files: ['package.json', 'next.config.js'],
      packageManifest: {
        dependencies: { next: '14.2.0', react: '18.2.0' },
        scripts: { build: 'next build', start: 'next start' },
      },
    });

    expect(result.language).toBe('nextjs');
    expect(result.target).toBe('cloud-run');
    expect(result.framework).toBe('nextjs');
    expect(result.buildCommand).toBe('npm run build');
  });

  it('should detect Vite static SPA with static-gcs target', () => {
    const result = detectRuntime({
      files: ['package.json', 'vite.config.ts', 'src/App.tsx'],
      packageManifest: {
        devDependencies: { vite: '^5.0.0' },
        scripts: { build: 'vite build' },
      },
    });

    expect(result.language).toBe('static-spa');
    expect(result.target).toBe('static-gcs');
    expect(result.framework).toBe('vite');
    expect(result.outputDir).toBe('dist');
  });

  it('should detect Node API (Express) with Cloud Run target', () => {
    const result = detectRuntime({
      files: ['package.json', 'index.js'],
      packageManifest: {
        dependencies: { express: '^4.19.0' },
        scripts: { start: 'node index.js' },
      },
    });

    expect(result.language).toBe('node-api');
    expect(result.target).toBe('cloud-run');
    expect(result.framework).toBe('express');
  });

  it('should detect Python project with Cloud Run target', () => {
    const result = detectRuntime({
      files: ['requirements.txt', 'main.py'],
    });

    expect(result.language).toBe('python');
    expect(result.target).toBe('cloud-run');
    expect(result.startCommand).toBe('python main.py');
  });

  it('should detect Go project with Cloud Run target', () => {
    const result = detectRuntime({
      files: ['go.mod', 'main.go'],
    });

    expect(result.language).toBe('go');
    expect(result.target).toBe('cloud-run');
    expect(result.startCommand).toBe('./server');
  });

  it('should detect Rust project with Cloud Run target', () => {
    const result = detectRuntime({
      files: ['Cargo.toml', 'src/main.rs'],
    });

    expect(result.language).toBe('rust');
    expect(result.target).toBe('cloud-run');
  });

  it('should detect Bun project with Cloud Run target', () => {
    const result = detectRuntime({
      files: ['package.json', 'bun.lockb', 'src/index.ts'],
    });

    expect(result.language).toBe('bun');
    expect(result.target).toBe('cloud-run');
    expect(result.buildCommand).toBe('bun install');
  });

  it('should detect Deno project with Cloud Run target', () => {
    const result = detectRuntime({
      files: ['deno.json', 'main.ts'],
    });

    expect(result.language).toBe('deno');
    expect(result.target).toBe('cloud-run');
    expect(result.buildCommand).toBe('deno cache main.ts');
  });
});
