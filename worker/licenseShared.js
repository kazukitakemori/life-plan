/**
 * @param {string} key
 */
export function normalizeLicenseKey(key) {
  return key.trim().toUpperCase().replace(/[\s-]+/g, '');
}

/**
 * @param {string} key
 * @param {string} pepper
 */
export async function hashLicenseKey(key, pepper) {
  const normalized = normalizeLicenseKey(key);
  const data = new TextEncoder().encode(`${pepper}:${normalized}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {string} key
 */
export function formatLicenseKeyForDisplay(key) {
  const normalized = normalizeLicenseKey(key);
  if (normalized.length !== 14 || !normalized.startsWith('LP')) {
    return key.trim().toUpperCase();
  }
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 6)}-${normalized.slice(6, 10)}-${normalized.slice(10, 14)}`;
}

/**
 * @param {string} key
 */
export function isLicenseKeyFormatValid(key) {
  const normalized = normalizeLicenseKey(key);
  return /^LP[A-Z0-9]{12}$/.test(normalized);
}

/**
 * @returns {string}
 */
export function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i += 1) {
    body += alphabet[bytes[i] % alphabet.length];
  }
  return formatLicenseKeyForDisplay(`LP${body}`);
}

/**
 * @param {string} key
 */
export function getLicenseKeyHint(key) {
  const normalized = normalizeLicenseKey(key);
  if (normalized.length < 6) return 'LP-????';
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 6)}-****`;
}

/**
 * @returns {string}
 */
export function createId() {
  return crypto.randomUUID();
}

/**
 * @param {unknown} value
 */
export function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * @param {Request} request
 */
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * @param {Request} request
 * @param {string} adminSecret
 */
export function isAdminAuthorized(request, adminSecret) {
  if (!adminSecret) return false;
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  return header.slice('Bearer '.length) === adminSecret;
}
