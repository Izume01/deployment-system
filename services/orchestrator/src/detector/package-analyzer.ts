import type { DetectionResult, PackageManifest } from './types';

/**
 * Analyzes package.json to identify framework and deployment target.
 * Follows Vercel and Nixpacks detection heuristics.
 */
export function analyzePackageJson(manifest: PackageManifest): DetectionResult {
  const deps = { ...manifest.dependencies, ...manifest.devDependencies };
  const scripts = manifest.scripts || {};

  // 1. Next.js detection
  if (deps.next) {
    return {
      language: 'nextjs',
      target: 'cloud-run',
      hasDockerfile: false,
      framework: 'nextjs',
      buildCommand: scripts.build ? 'npm run build' : 'next build',
      startCommand: scripts.start ? 'npm start' : 'next start',
      outputDir: '.next',
      confidence: 0.95,
    };
  }

  // 2. Static SPA detection (Vite or Create React App)
  if (deps.vite) {
    return {
      language: 'static-spa',
      target: 'static-gcs',
      hasDockerfile: false,
      framework: 'vite',
      buildCommand: scripts.build ? 'npm run build' : 'vite build',
      outputDir: 'dist',
      confidence: 0.9,
    };
  }

  if (deps['react-scripts']) {
    return {
      language: 'static-spa',
      target: 'static-gcs',
      hasDockerfile: false,
      framework: 'create-react-app',
      buildCommand: scripts.build ? 'npm run build' : 'react-scripts build',
      outputDir: 'build',
      confidence: 0.9,
    };
  }

  // 3. Node API detection (Express, Fastify, NestJS, Koa, Hono)
  const apiFrameworks = ['express', 'fastify', '@nestjs/core', 'koa', 'hono'];
  for (const fw of apiFrameworks) {
    if (deps[fw]) {
      return {
        language: 'node-api',
        target: 'cloud-run',
        hasDockerfile: false,
        framework: fw,
        buildCommand: scripts.build ? 'npm run build' : undefined,
        startCommand: scripts.start ? 'npm start' : 'node index.js',
        confidence: 0.85,
      };
    }
  }

  // 4. Generic Node.js fallback
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
