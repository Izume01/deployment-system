import { Storage } from '@google-cloud/storage';

let storageClient: Storage | null = null;

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

const MIME_MAP: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  webp: 'image/webp',
  woff2: 'font/woff2',
};

export function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

export function getCacheControl(filePath: string): string {
  if (filePath.endsWith('index.html') || filePath.endsWith('/')) {
    return 'public, max-age=0, must-revalidate';
  }
  if (filePath.includes('/assets/') || /[.-][a-f0-9]{8,}\./.test(filePath)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

/**
 * Streams static frontend assets from GCS with SPA client fallback.
 */
export async function streamStaticFromGCS(
  gcsUri: string,
  pathname: string,
): Promise<Response> {
  const cleanUri = gcsUri.replace('gs://', '');
  const [bucketName, ...prefixParts] = cleanUri.split('/');
  const basePrefix = prefixParts.join('/');

  const normalizedPath =
    pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const objectPath = basePrefix
    ? `${basePrefix}/${normalizedPath}`
    : normalizedPath;

  const storage = getStorage();
  const bucket = storage.bucket(bucketName);
  let file = bucket.file(objectPath);

  const [exists] = await file.exists();
  let finalPath = objectPath;

  if (!exists) {
    // SPA Fallback to index.html
    const fallbackPath = basePrefix ? `${basePrefix}/index.html` : 'index.html';
    const fallbackFile = bucket.file(fallbackPath);
    const [fallbackExists] = await fallbackFile.exists();

    if (!fallbackExists) {
      return new Response('404 Not Found', { status: 404 });
    }
    file = fallbackFile;
    finalPath = fallbackPath;
  }

  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();

  return new Response(buffer, {
    status: 200,
    headers: {
      'content-type': getMimeType(finalPath),
      'content-length': String(metadata.size || buffer.length),
      'cache-control': getCacheControl(finalPath),
      etag: metadata.etag || '',
      'x-served-by': 'paas-gcs-static',
    },
  });
}
