import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptPayload } from '../../api/get-data';

// Invented keys and bank, only for these tests. Every path is passed explicitly and the script runs
// inside a temporary directory, so its defaults (the real bank and key file) are never read.
const SCRIPT = fileURLToPath(new URL('../../scripts/encrypt-master-data.mjs', import.meta.url));
const BANK = [{ id: 'topic-1', name: 'Tema 1: ñandú', questions: [{ id: 'q1', text: '¿Sí?', answers: ['A', 'B'] }] }];
const KEY = randomBytes(32);

let dir: string;

function runScript(keyFileContent: string, env: Record<string, string> = {}) {
  const source = join(dir, 'bank.json');
  const output = join(dir, 'out', 'bank.encrypted.json');
  const keyFile = join(dir, 'key.txt');
  writeFileSync(source, `${JSON.stringify(BANK, null, 2)}\n`, 'utf8');
  writeFileSync(keyFile, keyFileContent, 'utf8');

  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  if (!('JSON_DECRYPT_KEY' in env)) {
    delete childEnv['JSON_DECRYPT_KEY'];
  }

  const result = spawnSync(process.execPath, [SCRIPT, source, output, keyFile], { cwd: dir, env: childEnv, encoding: 'utf8' });
  return { result, output };
}

describe('scripts/encrypt-master-data.mjs', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'test-maker-encrypt-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a v2 AES-256-GCM payload that the API decrypts with the same key', () => {
    const { result, output } = runScript(`${KEY.toString('hex')}\n`);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Encrypted file created');
    const raw = readFileSync(output, 'utf8');
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload).toMatchObject({ v: 2, algorithm: 'aes-256-gcm' });
    expect(Buffer.from(payload['iv'] as string, 'base64')).toHaveLength(12);
    expect(Buffer.from(payload['tag'] as string, 'base64')).toHaveLength(16);
    expect(decryptPayload(raw, KEY.toString('hex'))).toEqual(BANK);
  });

  it.each([
    ['64 hex characters', KEY.toString('hex')],
    ['base64 of 32 bytes', KEY.toString('base64')],
    ['32 UTF-8 bytes', 'invented-key-for-tests-only-0032'],
  ])('reads a key given as %s the same way the API does', (_label, keySource) => {
    const { result, output } = runScript(`  ${keySource}\r\n`);

    expect(result.status).toBe(0);
    expect(decryptPayload(readFileSync(output, 'utf8'), keySource)).toEqual(BANK);
  });

  it('uses JSON_DECRYPT_KEY instead of the key file when it is set', () => {
    const envKey = randomBytes(32).toString('base64');
    const { result, output } = runScript(KEY.toString('hex'), { JSON_DECRYPT_KEY: envKey });

    expect(result.status).toBe(0);
    const raw = readFileSync(output, 'utf8');
    expect(decryptPayload(raw, envKey)).toEqual(BANK);
    expect(() => decryptPayload(raw, KEY.toString('hex'))).toThrow('Encrypted payload failed authentication');
  });

  it('uses a new IV on every run', () => {
    const first = JSON.parse(readFileSync(runScript(KEY.toString('hex')).output, 'utf8')) as Record<string, string>;
    const second = JSON.parse(readFileSync(runScript(KEY.toString('hex')).output, 'utf8')) as Record<string, string>;

    expect(first['iv']).not.toBe(second['iv']);
    expect(first['data']).not.toBe(second['data']);
  });

  it('fails with exit code 1 and writes nothing when the key does not decode to 32 bytes', () => {
    const { result, output } = runScript('too-short');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('JSON_DECRYPT_KEY must decode to 32 bytes.');
    expect(existsSync(output)).toBe(false);
  });

  it('fails with exit code 1 and writes nothing when the source is not JSON', () => {
    const source = join(dir, 'broken.json');
    const output = join(dir, 'broken.encrypted.json');
    const keyFile = join(dir, 'key.txt');
    writeFileSync(source, '{ not json', 'utf8');
    writeFileSync(keyFile, KEY.toString('hex'), 'utf8');
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env['JSON_DECRYPT_KEY'];

    const result = spawnSync(process.execPath, [SCRIPT, source, output, keyFile], { cwd: dir, env, encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Failed to encrypt master data');
    expect(existsSync(output)).toBe(false);
  });
});
