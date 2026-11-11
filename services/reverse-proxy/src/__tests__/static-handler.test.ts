import { describe, expect, it } from 'bun:test';
import { getCacheControl, getMimeType } from '../static-handler';

describe('Static Asset Handler & Caching', () => {
  it('should return correct MIME types for common web formats', () => {
    expect(getMimeType('index.html')).toBe('text/html; charset=utf-8');
    expect(getMimeType('assets/app.js')).toBe(
      'application/javascript; charset=utf-8',
    );
    expect(getMimeType('style.css')).toBe('text/css; charset=utf-8');
    expect(getMimeType('logo.svg')).toBe('image/svg+xml');
    expect(getMimeType('data.json')).toBe('application/json; charset=utf-8');
    expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
  });

  it('should set must-revalidate for index.html', () => {
    expect(getCacheControl('index.html')).toBe(
      'public, max-age=0, must-revalidate',
    );
    expect(getCacheControl('/dashboard/')).toBe(
      'public, max-age=0, must-revalidate',
    );
  });

  it('should set 1-year immutable caching for hashed assets', () => {
    expect(getCacheControl('/assets/index-a7b9c1d2.js')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(getCacheControl('bundle.4f9a12c8.css')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('should set standard 1-hour cache for regular static files', () => {
    expect(getCacheControl('favicon.ico')).toBe('public, max-age=3600');
  });
});
