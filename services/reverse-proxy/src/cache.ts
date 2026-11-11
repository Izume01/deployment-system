import type { ProxyRoute, RegisterRouteInput, RouteTargetType } from './types';

/**
 * In-memory Route Registry and Cache.
 * Provides microsecond routing lookup from subdomain slug to deployment targets.
 */
export class RouteRegistry {
  private routes = new Map<string, ProxyRoute>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs = 1000 * 60 * 60) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Registers or updates a route mapping.
   */
  register(input: RegisterRouteInput): ProxyRoute {
    const slug = input.slug.toLowerCase().trim();
    const type: RouteTargetType =
      input.type ||
      (input.target.startsWith('gs://') ? 'static-gcs' : 'cloud-run');

    const route: ProxyRoute = {
      slug,
      type,
      target: input.target.trim(),
      containerId: input.containerId,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    this.routes.set(slug, route);
    return route;
  }

  /**
   * Resolves a route by slug and updates last access timestamp.
   */
  resolve(slug: string): ProxyRoute | null {
    const normalized = slug.toLowerCase().trim();
    const route = this.routes.get(normalized);
    if (!route) {
      return null;
    }

    // Check TTL expiry if configured
    if (this.defaultTtlMs > 0) {
      const age = Date.now() - route.lastAccessedAt.getTime();
      if (age > this.defaultTtlMs) {
        this.routes.delete(normalized);
        return null;
      }
    }

    route.lastAccessedAt = new Date();
    return route;
  }

  /**
   * Removes a route from registry.
   */
  remove(slug: string): boolean {
    return this.routes.delete(slug.toLowerCase().trim());
  }

  /**
   * Lists all currently registered routes.
   */
  list(): ProxyRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Number of active routes.
   */
  get size(): number {
    return this.routes.size;
  }

  /**
   * Clears all routes.
   */
  clear(): void {
    this.routes.clear();
  }
}

// Global singleton instance for the reverse proxy
export const routeRegistry = new RouteRegistry();
