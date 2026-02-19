import { createDecipheriv } from 'node:crypto';

type JsonRecord = Record<string, unknown>;

interface RawEncryptedPayload {
  iv: string;
  data: string;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export function GET(): Response {
  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readRequestBody(request);
    const password = typeof body.password === 'string' ? body.password : '';

    const appPassword = process.env.APP_PASSWORD ?? '';
    const decryptKey = process.env.JSON_DECRYPT_KEY ?? '';
    const encryptedJsonUrl = process.env.GITHUB_ENCRYPTED_JSON_URL ?? '';
    const githubToken = process.env.GITHUB_TOKEN ?? '';

    if (!appPassword || password !== appPassword) {
      return Response.json({ error: 'Invalid password' }, { status: 401, headers: NO_STORE_HEADERS });
    }

    if (!encryptedJsonUrl || !decryptKey) {
      return Response.json(
        { error: 'Server environment is not configured: GITHUB_ENCRYPTED_JSON_URL or JSON_DECRYPT_KEY missing' },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }

    const encryptedPayload = await fetchEncryptedPayload(encryptedJsonUrl, githubToken);
    const decryptedJson = decryptPayload(encryptedPayload, decryptKey);

    return Response.json({ data: decryptedJson }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return Response.json({ error: `Failed to decrypt JSON payload: ${message}` }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

async function readRequestBody(request: Request): Promise<{ password?: unknown }> {
  try {
    const parsed = (await request.json()) as { password?: unknown };
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function fetchEncryptedPayload(url: string, token: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain,application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
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
