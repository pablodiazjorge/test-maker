type JsonRecord = Record<string, unknown>;

export const runtime = 'nodejs';

interface RawEncryptedPayload {
  iv: string;
  data: string;
}

interface NodeApiRequest {
  method?: string;
  body?: unknown;
}

interface NodeApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => NodeApiResponse;
  json: (body: unknown) => void;
}

interface ApiResult {
  status: number;
  body: JsonRecord;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export default async function handler(arg1: unknown, arg2?: unknown): Promise<Response | void> {
  if (isNodeResponse(arg2)) {
    const req = isNodeRequest(arg1) ? arg1 : {};
    const res = arg2;
    res.setHeader('Cache-Control', 'no-store');

    try {
      const method = typeof req.method === 'string' ? req.method : 'GET';
      if (method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const body = readNodeBody(req.body);
      const result = await execute(body);
      res.status(result.status).json(result.body);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown server error';
      console.error('get-data node handler failed:', error);
      res.status(500).json({ error: `Unhandled function error: ${message}` });
      return;
    }
  }

  try {
    const request = arg1 as Request;
    const method = request?.method ?? 'GET';
    if (method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = await readWebBody(request);
    const result = await execute(body);
    return jsonResponse(result.body, result.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    console.error('get-data web handler failed:', error);
    return jsonResponse({ error: `Unhandled function error: ${message}` }, 500);
  }
}

function isNodeRequest(value: unknown): value is NodeApiRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return 'method' in value || 'body' in value;
}

function isNodeResponse(value: unknown): value is NodeApiResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NodeApiResponse>;
  return (
    typeof candidate.setHeader === 'function' &&
    typeof candidate.status === 'function' &&
    typeof candidate.json === 'function'
  );
}

function readNodeBody(rawBody: unknown): JsonRecord {
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

async function readWebBody(request: Request): Promise<JsonRecord> {
  try {
    const parsed = (await request.json()) as JsonRecord;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function execute(body: JsonRecord): Promise<ApiResult> {
  const passwordCandidate = body['password'];
  const password = typeof passwordCandidate === 'string' ? passwordCandidate : '';

  const appPassword = process.env['APP_PASSWORD'] ?? '';
  const decryptKey = process.env['JSON_DECRYPT_KEY'] ?? '';
  const encryptedJsonUrl = process.env['GITHUB_ENCRYPTED_JSON_URL'] ?? '';
  const githubToken = process.env['GITHUB_TOKEN'] ?? '';

  if (!appPassword || password !== appPassword) {
    return { status: 401, body: { error: 'Invalid password' } };
  }

  if (!encryptedJsonUrl || !decryptKey) {
    return {
      status: 500,
      body: { error: 'Server environment is not configured: GITHUB_ENCRYPTED_JSON_URL or JSON_DECRYPT_KEY missing' },
    };
  }

  try {
    const encryptedPayload = await fetchEncryptedPayload(encryptedJsonUrl, githubToken);
    const decryptedJson = await decryptPayload(encryptedPayload, decryptKey);
    return { status: 200, body: { data: decryptedJson } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return { status: 500, body: { error: `Failed to decrypt JSON payload: ${message}` } };
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

async function decryptPayload(payload: string, keySource: string): Promise<unknown> {
  const { createDecipheriv } = await import('node:crypto');
  const { Buffer } = await import('node:buffer');

  const key = resolveKey(keySource, Buffer);
  const { iv, data } = parseEncryptedPayload(payload, Buffer);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted) as unknown;
}

function parseEncryptedPayload(payload: string, BufferImpl: typeof Buffer): { iv: Buffer; data: Buffer } {
  const normalized = parseRawPayload(payload);
  const iv = decodeInput(normalized.iv, BufferImpl);
  const data = decodeInput(normalized.data, BufferImpl);

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
    const ivCandidate = parsed['iv'];
    const iv = typeof ivCandidate === 'string' ? ivCandidate : '';
    const dataCandidate = parsed['data'] ?? parsed['content'] ?? parsed['ciphertext'];
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

function resolveKey(keySource: string, BufferImpl: typeof Buffer): Buffer {
  const normalizedKey = keySource.trim();

  if (/^[a-fA-F0-9]{64}$/.test(normalizedKey)) {
    return BufferImpl.from(normalizedKey, 'hex');
  }

  if (/^[a-zA-Z0-9+/=]+$/.test(normalizedKey)) {
    const decoded = BufferImpl.from(normalizedKey, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  }

  const utf8Key = BufferImpl.from(normalizedKey, 'utf8');
  if (utf8Key.length === 32) {
    return utf8Key;
  }

  throw new Error('JSON_DECRYPT_KEY must decode to 32 bytes');
}

function decodeInput(value: string, BufferImpl: typeof Buffer): Buffer {
  if (/^[a-fA-F0-9]+$/.test(value) && value.length % 2 === 0) {
    return BufferImpl.from(value, 'hex');
  }
  return BufferImpl.from(value, 'base64');
}

function jsonResponse(body: JsonRecord, status: number): Response {
  if (typeof Response !== 'undefined' && typeof Response.json === 'function') {
    return Response.json(body, { status, headers: NO_STORE_HEADERS });
  }

  return new Response(JSON.stringify(body), { status, headers: NO_STORE_HEADERS });
}
