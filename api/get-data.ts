import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

type JsonRecord = Record<string, unknown>;

export const config = {
  runtime: 'nodejs',
};

interface EncryptedPayload {
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

export default async function handler(req: VercelRequestLike, res: VercelResponseLike): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseRequestBody(req.body);
    const passwordCandidate = body['password'];
    const password = typeof passwordCandidate === 'string' ? passwordCandidate : '';

    const appPassword = process.env['APP_PASSWORD'] ?? '';
    const decryptKey = process.env['JSON_DECRYPT_KEY'] ?? '';
    const encryptedJsonUrl = process.env['GITHUB_ENCRYPTED_JSON_URL'] ?? '';
    const githubToken = process.env['GITHUB_TOKEN'] ?? '';

    if (!appPassword || !decryptKey || !encryptedJsonUrl) {
      console.error('Missing environment variables');
      res.status(500).json({ error: 'Configuracion del servidor incompleta' });
      return;
    }

    if (password !== appPassword) {
      res.status(401).json({ error: 'Contrasena incorrecta' });
      return;
    }

    const encryptedRawData = await fetchEncryptedPayload(encryptedJsonUrl, githubToken);
    const decrypted = decryptPayload(encryptedRawData, decryptKey);
    res.status(200).json({ data: decrypted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Crash en API:', error);
    res.status(500).json({
      error: 'Error interno en el servidor',
      details: message,
    });
  }
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

async function fetchEncryptedPayload(url: string, token: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain,application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Error al descargar de GitHub: ${response.status}`);
  }

  return response.text();
}

function decryptPayload(payload: string, keySource: string): unknown {
  const key = resolveKey(keySource);
  const { iv, data } = parseEncryptedPayload(payload);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as unknown;
}

function parseEncryptedPayload(payload: string): { iv: Buffer; data: Buffer } {
  const normalized = parseRawEncryptedPayload(payload);
  const ivInfo = decodeIv(normalized['iv']);
  const data = decodeCipherData(normalized['data'], ivInfo.encoding);
  return { iv: ivInfo.value, data };
}

function parseRawEncryptedPayload(payload: string): EncryptedPayload {
  const trimmedPayload = payload.trim();
  if (!trimmedPayload) {
    throw new Error('Encrypted payload is empty');
  }

  if (trimmedPayload.startsWith('{')) {
    const parsed = JSON.parse(trimmedPayload) as JsonRecord;
    const ivCandidate = parsed['iv'];
    const dataCandidate = parsed['data'] ?? parsed['content'] ?? parsed['ciphertext'];
    const iv = typeof ivCandidate === 'string' ? ivCandidate : '';
    const data = typeof dataCandidate === 'string' ? dataCandidate : '';

    if (!iv || !data) {
      throw new Error('Invalid encrypted object payload');
    }

    return { iv, data };
  }

  const separatorIndex = trimmedPayload.indexOf(':');
  if (separatorIndex <= 0) {
    throw new Error('Encrypted payload must be iv:ciphertext');
  }

  const iv = trimmedPayload.slice(0, separatorIndex);
  const data = trimmedPayload.slice(separatorIndex + 1);
  if (!iv || !data) {
    throw new Error('Invalid iv:ciphertext payload');
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

  throw new Error('JSON_DECRYPT_KEY must decode to 32 bytes.');
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

  throw new Error('IV must decode to 16 bytes');
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

  throw new Error('Cipher data could not be decoded');
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
