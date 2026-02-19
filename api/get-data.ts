import { createDecipheriv } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

interface RawEncryptedPayload {
  iv: string;
  data: string;
}

interface HandlerRequest {
  method?: string;
  body?: {
    password?: unknown;
  };
}

interface HandlerResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
}

const APP_PASSWORD = process.env.APP_PASSWORD ?? '';
const JSON_DECRYPT_KEY = process.env.JSON_DECRYPT_KEY ?? '';
const GITHUB_ENCRYPTED_JSON_URL = process.env.GITHUB_ENCRYPTED_JSON_URL ?? '';

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!APP_PASSWORD || password !== APP_PASSWORD) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  if (!GITHUB_ENCRYPTED_JSON_URL || !JSON_DECRYPT_KEY) {
    res.status(500).json({ error: 'Server environment is not configured' });
    return;
  }

  try {
    const encryptedPayload = await fetchEncryptedPayload(GITHUB_ENCRYPTED_JSON_URL);
    const decryptedJson = decryptPayload(encryptedPayload, JSON_DECRYPT_KEY);
    res.status(200).json({ data: decryptedJson });
  } catch {
    res.status(500).json({ error: 'Failed to decrypt JSON payload' });
  }
}

async function fetchEncryptedPayload(url: string): Promise<string> {
  const response = await fetch(url, { headers: { Accept: 'text/plain,application/json' } });
  if (!response.ok) {
    throw new Error(`GitHub responded with ${response.status}`);
  }
  return response.text();
}

function decryptPayload(payload: string, keySource: string): unknown {
  const key = resolveKey(keySource);
  const { iv, data } = parseEncryptedPayload(payload);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as unknown;
}

function parseEncryptedPayload(payload: string): { iv: Buffer; data: Buffer } {
  const normalized = parseRawPayload(payload);
  const iv = decodeInput(normalized.iv);
  const data = decodeInput(normalized.data);

  if (iv.length !== 16) {
    throw new Error('IV must decode to 16 bytes');
  }

  return { iv, data };
}

function parseRawPayload(payload: string): RawEncryptedPayload {
  const trimmedPayload = payload.trim();
  if (!trimmedPayload) {
    throw new Error('Encrypted payload is empty');
  }

  if (trimmedPayload.startsWith('{')) {
    const parsed = JSON.parse(trimmedPayload) as JsonRecord;
    const iv = typeof parsed.iv === 'string' ? parsed.iv : '';
    const dataCandidate = parsed.data ?? parsed.content ?? parsed.ciphertext;
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

  if (/^[a-zA-Z0-9+/=]+$/.test(normalizedKey)) {
    const decoded = Buffer.from(normalizedKey, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  }

  const utf8Key = Buffer.from(normalizedKey, 'utf8');
  if (utf8Key.length === 32) {
    return utf8Key;
  }

  throw new Error('JSON_DECRYPT_KEY must decode to 32 bytes');
}

function decodeInput(value: string): Buffer {
  if (/^[a-fA-F0-9]+$/.test(value) && value.length % 2 === 0) {
    return Buffer.from(value, 'hex');
  }
  return Buffer.from(value, 'base64');
}
