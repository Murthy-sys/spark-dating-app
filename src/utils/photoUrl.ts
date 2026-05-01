/**
 * photoUrl.ts — repairs stale `/uploads/*` URLs at render time.
 *
 * Background: the backend stores the FULL upload URL in MongoDB, baked from
 * `req.protocol + '://' + req.get('host')` at upload time. Once the user
 * changes WiFi, restarts the backend on a different IP, or stops using a
 * tunnel they were on earlier, those URLs become unreachable.
 *
 * Fix: any uploads URL of the form http(s)://HOST/uploads/PATH is rewritten
 * to point at the client's CURRENT API host. External URLs (DiceBear,
 * Cloudinary, etc.) are left alone.
 *
 * This is a frontend-only band-aid. The real fix is to store relative paths
 * server-side and resolve them on read — say the word and I'll do that pass.
 */

import { BASE_URL } from '../services/apiClient';

// Strip the trailing `/api` (or `/api/`) from BASE_URL to get the host root.
const HOST_ROOT = BASE_URL.replace(/\/api\/?$/, '');

const UPLOADS_RE = /^https?:\/\/[^/]+(\/uploads\/.*)$/;

export function resolvePhotoUrl(raw: string | undefined | null): string {
  if (!raw) return '';
  const m = raw.match(UPLOADS_RE);
  if (!m) return raw;            // External URL — leave alone
  return `${HOST_ROOT}${m[1]}`;  // Re-host onto the current API origin
}
