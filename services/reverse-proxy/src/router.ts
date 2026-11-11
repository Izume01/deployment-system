/**
 * Extracts project slug from HTTP Host header.
 * Handles subdomains such as:
 * - <slug>.localhost:8000
 * - <slug>.localhost
 * - <slug>.yourdomain.com
 *
 * Returns null if the host is apex/root (e.g. localhost, 127.0.0.1) without a subdomain.
 */
export function extractSlug(
  hostHeader: string | null,
  apexDomain?: string,
): string | null {
  if (!hostHeader) {
    return null;
  }

  // Remove port if present
  const hostWithoutPort = hostHeader.split(':')[0].toLowerCase().trim();

  // Root hosts with no subdomains
  if (
    hostWithoutPort === 'localhost' ||
    hostWithoutPort === '127.0.0.1' ||
    hostWithoutPort === '0.0.0.0'
  ) {
    return null;
  }

  // If custom apex domain is specified (e.g. "myplatform.com")
  if (apexDomain) {
    const normalizedApex = apexDomain.toLowerCase().trim();
    if (hostWithoutPort === normalizedApex) {
      return null;
    }
    if (hostWithoutPort.endsWith(`.${normalizedApex}`)) {
      const subdomain = hostWithoutPort.slice(0, -(normalizedApex.length + 1));
      return sanitizeSlug(subdomain);
    }
  }

  // Default: treat first subdomain segment as slug
  const parts = hostWithoutPort.split('.');
  if (parts.length > 1) {
    const firstPart = parts[0];
    return sanitizeSlug(firstPart);
  }

  return null;
}

/**
 * Validates and cleans slug.
 */
function sanitizeSlug(raw: string): string | null {
  const sanitized = raw.toLowerCase().trim();
  if (!/^[a-z0-9-]+$/.test(sanitized)) {
    return null;
  }
  return sanitized;
}

/**
 * Checks if incoming path is a reverse proxy management/health path.
 */
export function isSystemPath(pathname: string): boolean {
  return (
    pathname === '/health' ||
    pathname === '/api/routes' ||
    pathname.startsWith('/api/routes/')
  );
}
