import { describe, expect, it } from 'bun:test';
import { RouteRegistry } from '../cache';

describe('Route Registry & Cache', () => {
  it('should register and resolve a Cloud Run route', () => {
    const registry = new RouteRegistry();
    registry.register({
      slug: 'express-sample',
      target: 'https://express-sample-36whzpprxq-uc.a.run.app',
    });

    const route = registry.resolve('express-sample');
    expect(route).not.toBeNull();
    expect(route?.slug).toBe('express-sample');
    expect(route?.type).toBe('cloud-run');
    expect(route?.target).toBe(
      'https://express-sample-36whzpprxq-uc.a.run.app',
    );
  });

  it('should auto-detect static-gcs type when target starts with gs://', () => {
    const registry = new RouteRegistry();
    registry.register({
      slug: 'vite-app',
      target: 'gs://paas-platform-12345-source-bucket/sites/vite-app',
    });

    const route = registry.resolve('vite-app');
    expect(route?.type).toBe('static-gcs');
  });

  it('should handle case-insensitive slug resolution', () => {
    const registry = new RouteRegistry();
    registry.register({
      slug: 'my-app',
      target: 'https://my-app.a.run.app',
    });

    expect(registry.resolve('MY-APP')?.slug).toBe('my-app');
  });

  it('should remove routes cleanly', () => {
    const registry = new RouteRegistry();
    registry.register({
      slug: 'temp-app',
      target: 'https://temp.a.run.app',
    });

    expect(registry.size).toBe(1);
    expect(registry.remove('temp-app')).toBe(true);
    expect(registry.size).toBe(0);
    expect(registry.resolve('temp-app')).toBeNull();
  });

  it('should expire route when TTL elapses', async () => {
    // 50ms TTL for testing
    const registry = new RouteRegistry(50);
    registry.register({
      slug: 'expiring-app',
      target: 'https://expiring.a.run.app',
    });

    expect(registry.resolve('expiring-app')).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(registry.resolve('expiring-app')).toBeNull();
  });
});
