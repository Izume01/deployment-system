import {
  GO_DOCKERFILE,
  NEXTJS_DOCKERFILE,
  NODE_API_DOCKERFILE,
  PYTHON_DOCKERFILE,
  RUST_DOCKERFILE,
  STATIC_SPA_DOCKERFILE,
} from './dockerfiles';
import type { TemplateInfo, TemplateName } from './types';

export const TEMPLATE_METADATA: Record<TemplateName, TemplateInfo> = {
  rust: {
    name: 'rust',
    language: 'Rust',
    description: 'Multi-stage static binary on Alpine Linux',
    estimatedSizeMb: 15,
  },
  go: {
    name: 'go',
    language: 'Go',
    description: 'Multi-stage static binary on Alpine Linux',
    estimatedSizeMb: 12,
  },
  python: {
    name: 'python',
    language: 'Python',
    description: 'FastAPI/Flask slim wheels runner with Uvicorn',
    estimatedSizeMb: 55,
  },
  next: {
    name: 'next',
    language: 'Next.js',
    description: 'Next.js standalone mode on Node.js Alpine',
    estimatedSizeMb: 70,
  },
  'static-spa': {
    name: 'static-spa',
    language: 'Static SPA',
    description: 'Static frontend bundle served by Nginx Alpine',
    estimatedSizeMb: 22,
  },
  'node-api': {
    name: 'node-api',
    language: 'Node.js',
    description: 'Production Node.js API runner on Alpine',
    estimatedSizeMb: 45,
  },
};

/**
 * Returns an optimized, multi-stage Dockerfile string for a given language or framework.
 * Returns null if no template exists for the requested language.
 */
export function getDockerfileTemplate(
  languageOrFramework: string,
): string | null {
  const key = languageOrFramework.toLowerCase().trim();

  switch (key) {
    case 'rust':
      return RUST_DOCKERFILE;
    case 'go':
    case 'golang':
      return GO_DOCKERFILE;
    case 'python':
      return PYTHON_DOCKERFILE;
    case 'next':
    case 'nextjs':
      return NEXTJS_DOCKERFILE;
    case 'vite':
    case 'static-spa':
    case 'spa':
      return STATIC_SPA_DOCKERFILE;
    case 'node':
    case 'node-api':
    case 'express':
    case 'fastify':
      return NODE_API_DOCKERFILE;
    default:
      return null;
  }
}
