type JsonRecord = Record<string, unknown>;

export const runtime = 'nodejs';

interface NodeApiRequest {
  method?: string;
}

interface NodeApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => NodeApiResponse;
  json: (body: unknown) => void;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

export default async function handler(arg1: unknown, arg2?: unknown): Promise<Response | void> {
  const payload = buildHealthPayload();

  if (isNodeResponse(arg2)) {
    const req = isNodeRequest(arg1) ? arg1 : {};
    const res = arg2;
    res.setHeader('Cache-Control', 'no-store');

    if (req.method && req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    res.status(200).json(payload);
    return;
  }

  const request = arg1 as Request | undefined;
  if (request?.method && request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  return jsonResponse(payload, 200);
}

function buildHealthPayload(): JsonRecord {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
    env: {
      APP_PASSWORD: hasEnv('APP_PASSWORD'),
      JSON_DECRYPT_KEY: hasEnv('JSON_DECRYPT_KEY'),
      GITHUB_ENCRYPTED_JSON_URL: hasEnv('GITHUB_ENCRYPTED_JSON_URL'),
      GITHUB_TOKEN: hasEnv('GITHUB_TOKEN'),
    },
  };
}

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

function jsonResponse(body: JsonRecord, status: number): Response {
  if (typeof Response !== 'undefined' && typeof Response.json === 'function') {
    return Response.json(body, { status, headers: NO_STORE_HEADERS });
  }

  return new Response(JSON.stringify(body), { status, headers: NO_STORE_HEADERS });
}

function isNodeRequest(value: unknown): value is NodeApiRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'method' in value;
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
