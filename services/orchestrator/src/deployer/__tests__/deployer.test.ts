import { describe, expect, it } from 'bun:test';
import { sanitizeServiceName } from '../service-manager';

describe('Cloud Run Service Deployer', () => {
  it('should sanitize service names correctly', () => {
    expect(sanitizeServiceName('My_Awesome_App!')).toBe('my-awesome-app');
    expect(sanitizeServiceName('---test---service---')).toBe('test-service');
    expect(sanitizeServiceName('app.with.dots')).toBe('app-with-dots');
  });

  it('should truncate service names longer than 63 characters', () => {
    const longName = 'a'.repeat(80);
    const sanitized = sanitizeServiceName(longName);
    expect(sanitized.length).toBe(63);
  });
});
