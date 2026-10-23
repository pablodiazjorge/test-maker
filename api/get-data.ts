import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export const config = {
  runtime: 'nodejs',
};

// Question banks use the v2 format written by scripts/encrypt-master-data.mjs:
// `{ "v": 2, "iv", "tag", "data" }`, base64 fields, AES-256-GCM with a 12-byte IV and a 16-byte tag.
// The tag authenticates the IV and the ciphertext, so a modified bank is rejected. Other fields
// (`algorithm`, `createdAt`) are ignored. The old AES-256-CBC format, with no `v` field, is rejected.
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

interface ParsedEncryptedPayload {
  iv: Buffer;
  tag: Buffer;
  data: Buffer;
}

interface VercelRequestLike {
  method?: string;
  body?: unknown;
}

interface VercelResponseLike {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
}

interface UserDatasetConfig {
  userId: string;
  passwordHash: string;
  decryptKey: string;
  encryptedJsonUrl: string;
}

interface ParsedPasswordHash {
  salt: Buffer;
  hash: Buffer;
}

// Passwords are checked against APP_USER_<n>_PASSWORD_HASH, in the format
// `scrypt$<salt-base64>$<hash-base64>`, produced by scripts/hash-password.mjs with Node's scrypt
// defaults (N = 16384, r = 8, p = 1), a random 16-byte salt and a 32-byte key.
// Quote the value in local .env files: some loaders expand `$`.
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MIN_SALT_LENGTH = 16;
// Unknown users are checked against this hash, so they cost the same scrypt run and always fail.
const DUMMY_PASSWORD_HASH: ParsedPasswordHash = {
  salt: Buffer.alloc(SCRYPT_MIN_SALT_LENGTH),
  hash: Buffer.alloc(SCRYPT_KEY_LENGTH),
};

export default async function handler(req: VercelRequestLike, res: VercelResponseLike): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseRequestBody(req.body);
    const usernameCandidate = body['username'];
    const passwordCandidate = body['password'];
    const username = typeof usernameCandidate === 'string' ? usernameCandidate.trim() : '';
    const password = typeof passwordCandidate === 'string' ? passwordCandidate : '';

    const userConfigs = readUserConfigsFromEnv();
    if (!userConfigs.length) {
      console.error('Missing multi-user environment configuration');
      res.status(500).json({ error: 'Incomplete server configuration' });
      return;
    }

    const selectedUser = userConfigs.find((user) => user.userId.toLowerCase() === username.toLowerCase()) ?? null;
    // Runs scrypt even when the user does not exist, so both cases take the same time.
    const passwordMatches = verifyPassword(password, selectedUser?.passwordHash);
    if (!selectedUser || !passwordMatches) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const githubToken = process.env['GITHUB_TOKEN'] ?? '';
    const encryptedRawData = await fetchEncryptedPayload(selectedUser.encryptedJsonUrl, githubToken);
    const decrypted = decryptPayload(encryptedRawData, selectedUser.decryptKey);
    res.status(200).json({ userId: selectedUser.userId, data: decrypted });
  } catch (error) {
    // The client only learns that something failed; the cause goes to the server log.
    console.error(`get-data failed: ${describeError(error)}`);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Errors thrown by this module carry fixed messages that are safe to log. Any other error is logged
// by name and code only: JSON.parse quotes part of its input (here it can be the decrypted bank)
// and fetch can quote the dataset URL.
class SafeError extends Error {}

function describeError(error: unknown): string {
  if (error instanceof SafeError) {
    return error.message;
  }

  if (!(error instanceof Error)) {
    return 'non-Error value thrown';
  }

  const codes = [error, error.cause]
    .map((item) => (item as { code?: unknown } | undefined)?.code)
    .filter((code): code is string => typeof code === 'string');
  return codes.length ? `${error.name} (${codes.join(', ')})` : error.name;
}

function parseRequestBody(rawBody: unknown): JsonRecord {
  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === 'object' && !Array.isArray(rawBody)) {
    return rawBody as JsonRecord;
  }

  if (typeof rawBody === 'string') {
    try {
      const parsed = JSON.parse(rawBody) as JsonRecord;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  return {};
}

export function parsePasswordHash(stored: string): ParsedPasswordHash | null {
  const parts = stored.trim().split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !parts[1] || !parts[2]) {
    return null;
  }

  const salt = Buffer.from(parts[1], 'base64');
  const hash = Buffer.from(parts[2], 'base64');
  // Anything but a 32-byte hash (a value that decodes to 0 bytes, say) is rejected here, before timingSafeEqual.
  if (salt.length < SCRYPT_MIN_SALT_LENGTH || hash.length !== SCRYPT_KEY_LENGTH) {
    return null;
  }

  return { salt, hash };
}

// Constant-time check of a password against a stored scrypt hash. A missing or malformed hash
// still costs one scrypt run, against the dummy hash, and never matches.
export function verifyPassword(candidate: string, stored: string | undefined): boolean {
  const parsed = stored === undefined ? null : parsePasswordHash(stored);
  const target = parsed ?? DUMMY_PASSWORD_HASH;
  const actual = crypto.scryptSync(candidate, target.salt, SCRYPT_KEY_LENGTH);
  return crypto.timingSafeEqual(actual, target.hash) && parsed !== null;
}

function readUserConfigsFromEnv(): UserDatasetConfig[] {
  const entries: UserDatasetConfig[] = [];

  for (const index of ['1', '2', '3']) {
    const prefix = `APP_USER_${index}`;
    const userId = (process.env[`${prefix}_USERNAME`] ?? '').trim();
    const passwordHash = (process.env[`${prefix}_PASSWORD_HASH`] ?? '').trim();
    const decryptKey = process.env[`${prefix}_DECRYPT_KEY`] ?? '';
    const encryptedJsonUrl = (process.env[`${prefix}_JSON_URL`] ?? '').trim();

    if (`${prefix}_PASSWORD` in process.env) {
      console.warn(`${prefix}_PASSWORD is ignored: passwords are checked against ${prefix}_PASSWORD_HASH. Remove it.`);
    }

    if (!userId || !decryptKey || !encryptedJsonUrl) {
      continue;
    }

    if (!parsePasswordHash(passwordHash)) {
      console.error(`${prefix} is disabled: ${prefix}_PASSWORD_HASH is missing or is not scrypt$<salt>$<hash>.`);
      continue;
    }

    entries.push({
      userId,
      passwordHash,
      decryptKey,
      encryptedJsonUrl,
    });
  }

  return entries;
}

async function fetchEncryptedPayload(url: string, token: string): Promise<string> {
  const resolvedUrl = normalizeGitHubContentUrl(url);
  const response = await fetch(resolvedUrl, {
    headers: {
      Accept: 'text/plain,application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new SafeError(`Error downloading from GitHub: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = await response.text();

  if (looksLikeHtmlPayload(payload, contentType)) {
    throw new SafeError('GitHub URL returned HTML, not encrypted content. Use raw file URL.');
  }

  return payload;
}

// Decrypts a v2 question bank with a key in any format resolveKey accepts.
export function decryptPayload(payload: string, keySource: string): unknown {
  const key = resolveKey(keySource);
  const decrypted = decryptBank(parseEncryptedPayload(payload), key);
  try {
    return JSON.parse(decrypted) as unknown;
  } catch {
    throw new SafeError('Decrypted payload is not valid JSON');
  }
}

function decryptBank(payload: ParsedEncryptedPayload, key: Buffer): string {
  // authTagLength stops Node from accepting a truncated tag.
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, payload.iv, { authTagLength: GCM_TAG_LENGTH });
  decipher.setAuthTag(payload.tag);
  try {
    // update() output is only used once final() has checked the tag.
    return Buffer.concat([decipher.update(payload.data), decipher.final()]).toString('utf8');
  } catch {
    throw new SafeError('Encrypted payload failed authentication');
  }
}

function parseEncryptedPayload(payload: string): ParsedEncryptedPayload {
  const trimmedPayload = payload.trim();
  if (!trimmedPayload) {
    throw new SafeError('Encrypted payload is empty');
  }

  if (looksLikeHtmlPayload(trimmedPayload, '')) {
    throw new SafeError('Encrypted payload appears to be HTML. Check GITHUB_ENCRYPTED_JSON_URL.');
  }

  if (!trimmedPayload.startsWith('{')) {
    throw new SafeError('Unsupported encrypted payload format');
  }

  let parsed: JsonRecord;
  try {
    parsed = JSON.parse(trimmedPayload) as JsonRecord;
  } catch {
    throw new SafeError('Encrypted payload is not valid JSON');
  }

  if (parsed['v'] !== 2) {
    throw new SafeError('Unsupported encrypted payload version');
  }

  return parseGcmPayload(parsed);
}

function parseGcmPayload(parsed: JsonRecord): ParsedEncryptedPayload {
  const iv = decodeBase64Field(parsed['iv']);
  const tag = decodeBase64Field(parsed['tag']);
  const data = decodeBase64Field(parsed['data']);
  if (!iv || iv.length !== GCM_IV_LENGTH || !tag || tag.length !== GCM_TAG_LENGTH || !data || data.length === 0) {
    throw new SafeError('Invalid v2 encrypted payload');
  }

  return { iv, tag, data };
}

function decodeBase64Field(value: unknown): Buffer | null {
  return typeof value === 'string' ? decodeBase64(value) : null;
}

function resolveKey(keySource: string): Buffer {
  const normalizedKey = keySource.trim();

  if (/^[a-fA-F0-9]{64}$/.test(normalizedKey)) {
    return Buffer.from(normalizedKey, 'hex');
  }

  if (/^[A-Za-z0-9+/=]+$/.test(normalizedKey)) {
    const decoded = Buffer.from(normalizedKey, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  }

  const utf8Key = Buffer.from(normalizedKey, 'utf8');
  if (utf8Key.length === 32) {
    return utf8Key;
  }

  throw new SafeError('JSON_DECRYPT_KEY must decode to 32 bytes.');
}

function decodeBase64(value: string): Buffer | null {
  const normalized = value.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    return null;
  }

  try {
    return Buffer.from(normalized, 'base64');
  } catch {
    return null;
  }
}

function normalizeGitHubContentUrl(inputUrl: string): string {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.hostname !== 'github.com') {
      return inputUrl;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 5 && pathParts[2] === 'blob') {
      const owner = pathParts[0];
      const repo = pathParts[1];
      const branch = pathParts[3];
      const filePath = pathParts.slice(4).join('/');
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    }

    if (pathParts.length >= 5 && pathParts[2] === 'raw') {
      const owner = pathParts[0];
      const repo = pathParts[1];
      const branch = pathParts[3];
      const filePath = pathParts.slice(4).join('/');
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
    }

    return inputUrl;
  } catch {
    return inputUrl;
  }
}

function looksLikeHtmlPayload(payload: string, contentType: string): boolean {
  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType.includes('text/html')) {
    return true;
  }

  const trimmed = payload.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}
