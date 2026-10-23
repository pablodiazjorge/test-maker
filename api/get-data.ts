import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export const config = {
  runtime: 'nodejs',
};

// Question banks come in two formats:
// - v2, written by scripts/encrypt-master-data.mjs: `{ "v": 2, "iv", "tag", "data" }`, base64
//   fields, AES-256-GCM with a 12-byte IV and a 16-byte tag. The tag authenticates the IV and the
//   ciphertext, so a modified bank is rejected. Other fields (`algorithm`, `createdAt`) are ignored.
// - Legacy (v1), with no `v` field: AES-256-CBC, not authenticated, as `{ "iv", "data" }` or
//   `iv:ciphertext`. It is still read so this version can be deployed before the banks are re-encrypted.
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

type ParsedEncryptedPayload =
  | { version: 1; iv: Buffer; data: Buffer }
  | { version: 2; iv: Buffer; tag: Buffer; data: Buffer };

interface LegacyEncryptedPayload {
  iv: string;
  data: string;
}

type PayloadEncoding = 'hex' | 'base64' | 'base64url' | 'utf8';

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

// Decrypts a question bank (v2 or legacy) with a key in any format resolveKey accepts.
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
  if (payload.version === 2) {
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

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, payload.iv);
  return Buffer.concat([decipher.update(payload.data), decipher.final()]).toString('utf8');
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
    return parseLegacyPayload(splitLegacyStringPayload(trimmedPayload));
  }

  let parsed: JsonRecord;
  try {
    parsed = JSON.parse(trimmedPayload) as JsonRecord;
  } catch {
    throw new SafeError('Encrypted payload is not valid JSON');
  }

  if (!('v' in parsed)) {
    return parseLegacyPayload(readLegacyObjectPayload(parsed));
  }

  if (parsed['v'] === 2) {
    return parseGcmPayload(parsed);
  }

  throw new SafeError('Unsupported encrypted payload version');
}

function parseGcmPayload(parsed: JsonRecord): ParsedEncryptedPayload {
  const iv = decodeBase64Field(parsed['iv']);
  const tag = decodeBase64Field(parsed['tag']);
  const data = decodeBase64Field(parsed['data']);
  if (!iv || iv.length !== GCM_IV_LENGTH || !tag || tag.length !== GCM_TAG_LENGTH || !data || data.length === 0) {
    throw new SafeError('Invalid v2 encrypted payload');
  }

  return { version: 2, iv, tag, data };
}

function decodeBase64Field(value: unknown): Buffer | null {
  return typeof value === 'string' ? decodeBase64(value) : null;
}

function parseLegacyPayload(payload: LegacyEncryptedPayload): ParsedEncryptedPayload {
  const ivInfo = decodeIv(payload.iv);
  const data = decodeCipherData(payload.data, ivInfo.encoding);
  return { version: 1, iv: ivInfo.value, data };
}

function readLegacyObjectPayload(parsed: JsonRecord): LegacyEncryptedPayload {
  const ivCandidate = parsed['iv'];
  const dataCandidate = parsed['data'] ?? parsed['content'] ?? parsed['ciphertext'];
  const iv = typeof ivCandidate === 'string' ? ivCandidate : '';
  const data = typeof dataCandidate === 'string' ? dataCandidate : '';

  if (!iv || !data) {
    throw new SafeError('Invalid encrypted object payload');
  }

  return { iv, data };
}

function splitLegacyStringPayload(payload: string): LegacyEncryptedPayload {
  const separatorIndex = payload.indexOf(':');
  if (separatorIndex <= 0) {
    throw new SafeError('Encrypted payload must be iv:ciphertext');
  }

  const iv = payload.slice(0, separatorIndex);
  const data = payload.slice(separatorIndex + 1);
  if (!iv || !data) {
    throw new SafeError('Invalid iv:ciphertext payload');
  }

  return { iv, data };
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

function decodeIv(rawValue: string): { value: Buffer; encoding: PayloadEncoding } {
  const value = rawValue.trim();

  if (isHex(value) && value.length === 32) {
    return { value: Buffer.from(value, 'hex'), encoding: 'hex' };
  }

  const base64Buffer = decodeBase64(value);
  if (base64Buffer && base64Buffer.length === 16) {
    return { value: base64Buffer, encoding: 'base64' };
  }

  const base64UrlBuffer = decodeBase64Url(value);
  if (base64UrlBuffer && base64UrlBuffer.length === 16) {
    return { value: base64UrlBuffer, encoding: 'base64url' };
  }

  const utf8Buffer = Buffer.from(value, 'utf8');
  if (utf8Buffer.length === 16) {
    return { value: utf8Buffer, encoding: 'utf8' };
  }

  throw new SafeError('IV must decode to 16 bytes');
}

function decodeCipherData(rawValue: string, preferredEncoding: PayloadEncoding): Buffer {
  const value = rawValue.trim();
  const orderedEncodings: PayloadEncoding[] = [preferredEncoding, 'base64', 'base64url', 'hex'];

  for (const encoding of orderedEncodings) {
    const decoded = decodeByEncoding(value, encoding);
    if (decoded && decoded.length > 0) {
      return decoded;
    }
  }

  throw new SafeError('Cipher data could not be decoded');
}

function decodeByEncoding(value: string, encoding: PayloadEncoding): Buffer | null {
  if (encoding === 'hex') {
    if (!isHex(value) || value.length % 2 !== 0) {
      return null;
    }
    return Buffer.from(value, 'hex');
  }

  if (encoding === 'base64') {
    return decodeBase64(value);
  }

  if (encoding === 'base64url') {
    return decodeBase64Url(value);
  }

  return Buffer.from(value, 'utf8');
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

function decodeBase64Url(value: string): Buffer | null {
  const normalized = value.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9\-_]+$/.test(normalized)) {
    return null;
  }

  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=').replace(/-/g, '+').replace(/_/g, '/');
  return decodeBase64(padded);
}

function isHex(value: string): boolean {
  return /^[a-fA-F0-9]+$/.test(value);
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
