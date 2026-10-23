import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { decryptPayload, verifyPassword } from '../../api/get-data';

// Invented passwords, keys and banks, only for these tests.
const PASSWORD = 'correct horse battery staple';
const OTHER_PASSWORD = 'tr0ub4dor&3';

function scryptHash(password: string, salt = randomBytes(16), keyLength = 32): string {
  return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, keyLength).toString('base64')}`;
}

// v2: AES-256-GCM, the format written by scripts/encrypt-master-data.mjs.
function encryptBank(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return JSON.stringify({
    v: 2,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  });
}

// Legacy (v1): AES-256-CBC with no version field, the format of the banks before October 2026,
// which the API no longer reads.
function encryptBankV1(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return JSON.stringify({ algorithm: 'aes-256-cbc', iv: iv.toString('base64'), data: data.toString('base64') });
}

// Flips one bit of a base64 field of a v2 payload.
function tamper(payload: string, field: 'iv' | 'tag' | 'data'): string {
  const parsed = JSON.parse(payload) as Record<string, string>;
  const bytes = Buffer.from(parsed[field], 'base64');
  bytes[0] ^= 0x01;
  return JSON.stringify({ ...parsed, [field]: bytes.toString('base64') });
}

describe('decryptPayload', () => {
  const bank = [{ id: 'topic-1', name: 'Tema 1: ñandú', questions: [{ id: 'q1', text: '¿Sí?' }] }];
  const plaintext = JSON.stringify(bank);
  const key = randomBytes(32);
  const keyHex = key.toString('hex');

  it.each([
    ['64 hex characters', keyHex],
    ['base64 of 32 bytes', key.toString('base64')],
  ])('reads a v2 payload with a key given as %s', (_label, keySource) => {
    expect(decryptPayload(encryptBank(plaintext, key), keySource)).toEqual(bank);
  });

  it('reads a v2 payload with a key given as 32 UTF-8 bytes', () => {
    const utf8Key = 'invented-key-for-tests-only-0032';

    expect(decryptPayload(encryptBank(plaintext, Buffer.from(utf8Key, 'utf8')), utf8Key)).toEqual(bank);
  });

  it('ignores the extra fields the script writes', () => {
    const payload = { ...JSON.parse(encryptBank(plaintext, key)), algorithm: 'aes-256-gcm', createdAt: '2026-10-01T00:00:00.000Z' };

    expect(decryptPayload(JSON.stringify(payload), keyHex)).toEqual(bank);
  });

  it('rejects a legacy v1 (AES-256-CBC) object payload', () => {
    expect(() => decryptPayload(encryptBankV1(plaintext, key), keyHex)).toThrow('Unsupported encrypted payload version');
  });

  it('rejects a legacy v1 iv:ciphertext payload', () => {
    const { iv, data } = JSON.parse(encryptBankV1(plaintext, key)) as { iv: string; data: string };

    expect(() => decryptPayload(`${iv}:${data}`, keyHex)).toThrow('Unsupported encrypted payload format');
  });

  it.each(['tag', 'iv', 'data'] as const)('rejects a v2 payload whose %s was altered', (field) => {
    const payload = tamper(encryptBank(plaintext, key), field);

    expect(() => decryptPayload(payload, keyHex)).toThrow('Encrypted payload failed authentication');
  });

  it('rejects a v2 payload encrypted with another key', () => {
    expect(() => decryptPayload(encryptBank(plaintext, randomBytes(32)), keyHex)).toThrow('Encrypted payload failed authentication');
  });

  it.each([
    ['a truncated tag', { tag: randomBytes(12).toString('base64') }],
    ['a 16-byte IV', { iv: randomBytes(16).toString('base64') }],
    ['a missing tag', { tag: undefined }],
    ['a tag that is not base64', { tag: '!'.repeat(24) }],
    ['empty data', { data: '' }],
  ])('rejects a v2 payload with %s', (_label, override) => {
    const payload = JSON.stringify({ ...JSON.parse(encryptBank(plaintext, key)), ...override });

    expect(() => decryptPayload(payload, keyHex)).toThrow('Invalid v2 encrypted payload');
  });

  it.each([
    ['3', 3],
    ['"2" as a string', '2'],
    ['1 (the legacy format has no version field)', 1],
    ['null', null],
  ])('rejects version %s', (_label, version) => {
    const payload = JSON.stringify({ ...JSON.parse(encryptBank(plaintext, key)), v: version });

    expect(() => decryptPayload(payload, keyHex)).toThrow('Unsupported encrypted payload version');
  });
});

interface CapturedResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => CapturedResponse;
  json: (body: unknown) => void;
}

function createResponse(): CapturedResponse {
  const response: CapturedResponse = {
    statusCode: 0,
    body: undefined,
    headers: {},
    setHeader: (name, value) => {
      response.headers[name] = value;
    },
    status: (code) => {
      response.statusCode = code;
      return response;
    },
    json: (body) => {
      response.body = body;
    },
  };
  return response;
}

async function login(username: string, password: string): Promise<CapturedResponse> {
  const response = createResponse();
  await handler({ method: 'POST', body: { username, password } }, response);
  return response;
}

describe('verifyPassword', () => {
  it('accepts the right password', () => {
    expect(verifyPassword(PASSWORD, scryptHash(PASSWORD))).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(verifyPassword(OTHER_PASSWORD, scryptHash(PASSWORD))).toBe(false);
  });

  it('rejects every password when there is no stored hash (unknown user, dummy hash)', () => {
    expect(verifyPassword(PASSWORD, undefined)).toBe(false);
    expect(verifyPassword('', undefined)).toBe(false);
  });

  const salt = randomBytes(16).toString('base64');
  const key = randomBytes(32).toString('base64');
  it.each([
    ['an empty value', ''],
    ['another scheme', `bcrypt$${salt}$${key}`],
    ['a missing salt', `scrypt$$${key}`],
    ['a missing hash', `scrypt$${salt}$`],
    ['an extra segment', `scrypt$${salt}$${key}$extra`],
    ['a hash that decodes to 0 bytes', `scrypt$${salt}$====`],
    ['a 16-byte hash', `scrypt$${salt}$${randomBytes(16).toString('base64')}`],
    ['a salt shorter than 16 bytes', scryptHash(PASSWORD, randomBytes(8))],
    ['a plaintext password stored by mistake', PASSWORD],
  ])('rejects a stored hash with %s', (_label, stored) => {
    expect(verifyPassword(PASSWORD, stored)).toBe(false);
  });
});

describe('POST /api/get-data', () => {
  const bank = [{ id: 'topic-1', name: 'Topic 1', questions: [] }];
  const decryptKey = randomBytes(32);
  let fetchMock: ReturnType<typeof vi.fn>;

  function configureUser(index: string, username: string, passwordHash: string | undefined): void {
    vi.stubEnv(`APP_USER_${index}_USERNAME`, username);
    vi.stubEnv(`APP_USER_${index}_PASSWORD_HASH`, passwordHash);
    vi.stubEnv(`APP_USER_${index}_DECRYPT_KEY`, decryptKey.toString('hex'));
    vi.stubEnv(`APP_USER_${index}_JSON_URL`, `https://example.invalid/bank-${index}.json`);
  }

  beforeEach(() => {
    for (const index of ['1', '2', '3']) {
      for (const suffix of ['USERNAME', 'PASSWORD', 'PASSWORD_HASH', 'DECRYPT_KEY', 'JSON_URL']) {
        vi.stubEnv(`APP_USER_${index}_${suffix}`, undefined);
      }
    }
    vi.stubEnv('GITHUB_TOKEN', undefined);
    fetchMock = vi.fn(async () => new Response(encryptBank(JSON.stringify(bank), decryptKey), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the decrypted bank for the right password', async () => {
    configureUser('1', 'alice', scryptHash(PASSWORD));

    const response = await login('Alice', PASSWORD);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ userId: 'alice', data: bank });
    expect(response.headers['Cache-Control']).toBe('no-store');
  });

  it('answers 401 to a wrong password without fetching the bank', async () => {
    configureUser('1', 'alice', scryptHash(PASSWORD));

    const response = await login('alice', OTHER_PASSWORD);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers the same 401 to an unknown user', async () => {
    configureUser('1', 'alice', scryptHash(PASSWORD));

    const response = await login('mallory', PASSWORD);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets nobody in when the hash variable is missing, even with the old plaintext variable set', async () => {
    configureUser('1', 'alice', undefined);
    vi.stubEnv('APP_USER_1_PASSWORD', PASSWORD);

    const response = await login('alice', PASSWORD);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Incomplete server configuration' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('APP_USER_1_PASSWORD_HASH'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('APP_USER_1_PASSWORD is ignored'));
  });

  it('disables a user whose hash is malformed and keeps the others working', async () => {
    configureUser('1', 'alice', `scrypt$${randomBytes(16).toString('base64')}$`);
    configureUser('2', 'bob', scryptHash(OTHER_PASSWORD));

    const alice = await login('alice', PASSWORD);
    const bob = await login('bob', OTHER_PASSWORD);

    expect(alice.statusCode).toBe(401);
    expect(bob.statusCode).toBe(200);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('APP_USER_1_PASSWORD_HASH'));
  });

  it('answers a bare 500 to a legacy v1 (AES-256-CBC) bank', async () => {
    configureUser('1', 'alice', scryptHash(PASSWORD));
    fetchMock.mockResolvedValue(new Response(encryptBankV1(JSON.stringify(bank), decryptKey)));

    const response = await login('alice', PASSWORD);

    expect(response.statusCode).toBe(500);
    expect(response.body).toStrictEqual({ error: 'Internal server error' });
  });

  it('answers 405 to methods other than POST', async () => {
    const response = createResponse();

    await handler({ method: 'GET' }, response);

    expect(response.statusCode).toBe(405);
  });

  describe('when something fails after the login', () => {
    function loggedErrors(): string {
      return JSON.stringify(vi.mocked(console.error).mock.calls);
    }

    it('answers a bare 500 and logs no plaintext when the decrypted bank is not JSON', async () => {
      configureUser('1', 'alice', scryptHash(PASSWORD));
      fetchMock.mockResolvedValue(new Response(encryptBank('not json: SECRET QUESTION TEXT', decryptKey)));

      const response = await login('alice', PASSWORD);

      expect(response.statusCode).toBe(500);
      expect(response.body).toStrictEqual({ error: 'Internal server error' });
      expect(loggedErrors()).toContain('Decrypted payload is not valid JSON');
      expect(loggedErrors()).not.toContain('SECRET QUESTION TEXT');
    });

    it('logs only the name of unexpected errors, whose message can quote the dataset URL', async () => {
      configureUser('1', 'alice', scryptHash(PASSWORD));
      fetchMock.mockRejectedValue(new TypeError('Failed to parse URL from https://example.invalid/?token=abc123'));

      const response = await login('alice', PASSWORD);

      expect(response.statusCode).toBe(500);
      expect(response.body).toStrictEqual({ error: 'Internal server error' });
      expect(loggedErrors()).toContain('TypeError');
      expect(loggedErrors()).not.toContain('abc123');
    });

    it('logs the fixed message of its own errors', async () => {
      configureUser('1', 'alice', scryptHash(PASSWORD));
      fetchMock.mockResolvedValue(new Response('Not Found', { status: 404 }));

      const response = await login('alice', PASSWORD);

      expect(response.statusCode).toBe(500);
      expect(response.body).toStrictEqual({ error: 'Internal server error' });
      expect(loggedErrors()).toContain('Error downloading from GitHub: 404');
    });

    it('logs a fixed message for a wrong decryption key without returning it', async () => {
      configureUser('1', 'alice', scryptHash(PASSWORD));
      vi.stubEnv('APP_USER_1_DECRYPT_KEY', randomBytes(32).toString('hex'));

      const response = await login('alice', PASSWORD);

      expect(response.statusCode).toBe(500);
      expect(response.body).toStrictEqual({ error: 'Internal server error' });
      expect(loggedErrors()).toContain('get-data failed: Encrypted payload failed authentication');
    });

    it('answers a bare 500 to a bank whose tag does not match', async () => {
      configureUser('1', 'alice', scryptHash(PASSWORD));
      fetchMock.mockResolvedValue(new Response(tamper(encryptBank(JSON.stringify(bank), decryptKey), 'tag')));

      const response = await login('alice', PASSWORD);

      expect(response.statusCode).toBe(500);
      expect(response.body).toStrictEqual({ error: 'Internal server error' });
      expect(loggedErrors()).toContain('Encrypted payload failed authentication');
    });

    it('answers a bare 500 to a bank with an unknown version', async () => {
      configureUser('1', 'alice', scryptHash(PASSWORD));
      const payload = { ...JSON.parse(encryptBank(JSON.stringify(bank), decryptKey)), v: 3 };
      fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));

      const response = await login('alice', PASSWORD);

      expect(response.statusCode).toBe(500);
      expect(response.body).toStrictEqual({ error: 'Internal server error' });
      expect(loggedErrors()).toContain('Unsupported encrypted payload version');
    });
  });
});
