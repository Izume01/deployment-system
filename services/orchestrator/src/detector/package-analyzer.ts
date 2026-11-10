import { frameworks } from '@vercel/frameworks';
import type { DetectionResult, PackageManifest } from './types';

interface FrameworkDetector {
  matchPackage?: string;
}

interface VercelFramework {
  slug: string | null;
  name?: string;
  detectors?: {
    every?: FrameworkDetector[];
  };
  settings?: {
    buildCommand?: { value?: string; placeholder?: string };
    outputDirectory?: { value?: string; placeholder?: string };
  };
}

const STATIC_FRAMEWORK_SLUGS = new Set<string>([
  'vite',
  'create-react-app',
  'astro',
  'gatsby',
  'vue',
  'svelte',
  'solidstart',
  'eleventy',
]);

const NODE_API_FRAMEWORKS = [
  'express',
  'fastify',
  '@nestjs/core',
  'koa',
  'hono',
] as const;

/**
 * Leverages official @vercel/frameworks catalog to detect JavaScript/TypeScript frameworks.
 */
export function analyzePackageJson(manifest: PackageManifest): DetectionResult {
  const deps: Record<string, string> = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  const scripts = manifest.scripts || {};

  // 1. Match against official Vercel frameworks catalog
  for (const raw of frameworks) {
    const f = raw as unknown as VercelFramework;
    if (!f.slug || !f.detectors?.every) continue;

    const everyDetectors = f.detectors.every;
    const matchesEvery = everyDetectors.every((detector: FrameworkDetector) => {
      if (detector.matchPackage) {
        return Boolean(deps[detector.matchPackage]);
      }
      return true;
    });

    const hasPackageMatcher = everyDetectors.some((d: FrameworkDetector) =>
      Boolean(d.matchPackage),
    );

    if (matchesEvery && hasPackageMatcher) {
      if (f.slug === 'nextjs') {
        return {
          language: 'nextjs',
          target: 'cloud-run',
          hasDockerfile: false,
          framework: 'nextjs',
          buildCommand: scripts.build
            ? 'npm run build'
            : f.settings?.buildCommand?.value || 'next build',
          startCommand: scripts.start ? 'npm start' : 'next start',
          outputDir: '.next',
          confidence: 0.98,
        };
      }

      if (STATIC_FRAMEWORK_SLUGS.has(f.slug)) {
        return {
          language: 'static-spa',
          target: 'static-gcs',
          hasDockerfile: false,
          framework: f.slug,
          buildCommand: scripts.build
            ? 'npm run build'
            : f.settings?.buildCommand?.value || 'npm run build',
          outputDir: f.settings?.outputDirectory?.value || 'dist',
          confidence: 0.95,
        };
      }
    }
  }

  // 2. Node Backend APIs (Express, Fastify, Nest, Koa, Hono)
  for (const api of NODE_API_FRAMEWORKS) {
    if (deps[api]) {
      return {
        language: 'node-api',
        target: 'cloud-run',
        hasDockerfile: false,
        framework: api,
        buildCommand: scripts.build ? 'npm run build' : undefined,
        startCommand: scripts.start ? 'npm start' : 'node index.js',
        confidence: 0.9,
      };
    }
  }

  // 3. Generic Node.js fallback
  return {
    language: 'node-api',
    target: 'cloud-run',
    hasDockerfile: false,
    framework: 'node',
    buildCommand: scripts.build ? 'npm run build' : undefined,
    startCommand: scripts.start ? 'npm start' : 'node index.js',
    confidence: 0.7,
  };
}
