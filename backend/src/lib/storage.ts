/**
 * Image storage.
 *
 * Two backends behind one interface. Production is Cloudflare R2 — no egress
 * fees on an image-heavy storefront, and a different vendor from the one
 * holding the database. Development writes to disk.
 *
 * Local disk is NOT viable in production: Railway and Render filesystems are
 * ephemeral, so uploads vanish on redeploy. If R2 is unconfigured in
 * production the server says so at boot rather than losing files quietly.
 * See docs/ADMIN.md §4.4 and docs/DEPLOYMENT.md §3.
 */
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { env, isProduction } from './env.js';
import { ApiError } from './errors.js';
import { logger } from './logger.js';

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
]);

const MAX_BYTES = 5 * 1024 * 1024;

/** Public path under frontend/public, so dev uploads serve like seeded images. */
const LOCAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../frontend/public/uploads');

export const r2Configured = Boolean(
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
);

if (isProduction && !r2Configured) {
  console.warn(
    '[storage] R2 is not configured. Uploads would be written to an ephemeral ' +
      'filesystem and lost on the next deploy. Configure R2 before accepting uploads.',
  );
}

export interface StoredImage {
  /** The path stored on the product row and rendered by the storefront. */
  url: string;
  bytes: number;
}

export async function storeImage(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<StoredImage> {
  const ext = ALLOWED.get(mimeType);
  if (!ext) {
    throw new ApiError(400, 'UNSUPPORTED_IMAGE', 'Upload a JPEG, PNG, WebP or AVIF image.');
  }
  if (buffer.length > MAX_BYTES) {
    throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Images must be under 5 MB.');
  }

  // Name from a UUID, never from the upload: a filename is attacker-supplied
  // and path traversal is not worth the risk for a cosmetic benefit.
  const name = `${randomUUID()}${ext}`;

  if (r2Configured) {
    await putToR2(name, buffer, mimeType);
    return { url: `${env.R2_PUBLIC_URL}/${name}`, bytes: buffer.length };
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(join(LOCAL_DIR, name), buffer);
  logger.info({ name, bytes: buffer.length, original: extname(originalName) }, 'image stored locally');
  return { url: `/uploads/${name}`, bytes: buffer.length };
}

export async function deleteImage(url: string): Promise<void> {
  if (url.startsWith('/uploads/')) {
    await unlink(join(LOCAL_DIR, url.replace('/uploads/', ''))).catch(() => {});
  }
  // R2 deletion is deliberately manual for now: an image referenced by an old
  // order's item snapshot must not disappear because a product was edited.
}

/** S3-compatible PUT. R2 speaks the S3 API, so no SDK is needed for one call. */
async function putToR2(name: string, buffer: Buffer, mimeType: string) {
  const { AwsClient } = await import('aws4fetch');
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: 'auto',
  });
  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${name}`;
  const res = await client.fetch(endpoint, {
    method: 'PUT',
    body: buffer,
    headers: { 'Content-Type': mimeType },
  });
  if (!res.ok) {
    logger.error({ status: res.status, name }, 'R2 upload failed');
    throw new ApiError(502, 'UPLOAD_FAILED', 'Could not store the image. Please try again.');
  }
}
