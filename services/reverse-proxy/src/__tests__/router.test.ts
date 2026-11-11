import { describe, expect, it } from 'bun:test';
import { extractSlug, isSystemPath } from '../router';

describe('Reverse Proxy Router', () => {
  it('should extract slug from .localhost:8000 subdomain', () => {
    const slug = extractSlug('express-sample.localhost:8000');
    expect(slug).toBe('express-sample');
  });

  it('should extract slug from .localhost without port', () => {
    const slug = extractSlug('my-app.localhost');
    expect(slug).toBe('my-app');
  });

  it('should extract slug from custom apex domain', () => {
    const slug = extractSlug('api-service.myplatform.com', 'myplatform.com');
    expect(slug).toBe('api-service');
  });

  it('should return null for root localhost or IP address', () => {
    expect(extractSlug('localhost:8000')).toBeNull();
    expect(extractSlug('localhost')).toBeNull();
    expect(extractSlug('127.0.0.1:8000')).toBeNull();
    expect(extractSlug('127.0.0.1')).toBeNull();
  });

  it('should return null for apex domain without subdomain', () => {
    expect(extractSlug('myplatform.com', 'myplatform.com')).toBeNull();
  });

  it('should return null for invalid or malicious characters in slug', () => {
    expect(extractSlug('evil_app!.localhost:8000')).toBeNull();
    expect(extractSlug('../app.localhost:8000')).toBeNull();
  });

  it('should identify system paths correctly', () => {
    expect(isSystemPath('/health')).toBe(true);
    expect(isSystemPath('/api/routes')).toBe(true);
    expect(isSystemPath('/api/routes/express-sample')).toBe(true);
    expect(isSystemPath('/')).toBe(false);
    expect(isSystemPath('/users/profile')).toBe(false);
  });
});
