import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../api/get-data';
import { hashPassword } from '../../scripts/hash-password.mjs';

// Invented password, only for these tests.
const PASSWORD = 'correct horse battery staple';
const SCRIPT = fileURLToPath(new URL('../../scripts/hash-password.mjs', import.meta.url));
const HASH_FORMAT = /^scrypt\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/;

function runScript(args: string[], input: string) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: 'utf8' });
}

describe('scripts/hash-password.mjs', () => {
  it('produces a value that the API accepts for the same password only', () => {
    const stored = hashPassword(PASSWORD);

    expect(stored).toMatch(HASH_FORMAT);
    expect(verifyPassword(PASSWORD, stored)).toBe(true);
    expect(verifyPassword(`${PASSWORD}!`, stored)).toBe(false);
  });

  it('uses a new salt every time', () => {
    expect(hashPassword(PASSWORD)).not.toBe(hashPassword(PASSWORD));
  });

  it('refuses an empty password', () => {
    expect(() => hashPassword('')).toThrow('must not be empty');
  });

  it('prints only the value when the password comes from standard input', () => {
    const result = runScript([], `  ${PASSWORD}  \r\nsecond line\n`);

    expect(result.status).toBe(0);
    expect(result.stdout.endsWith('\n')).toBe(true);
    expect(result.stdout.trimEnd()).toMatch(HASH_FORMAT);
    expect(verifyPassword(PASSWORD, result.stdout.trimEnd())).toBe(true);
  });

  it('takes the password from the argument and warns on stderr', () => {
    const result = runScript([PASSWORD], '');

    expect(result.status).toBe(0);
    expect(verifyPassword(PASSWORD, result.stdout.trim())).toBe(true);
    expect(result.stderr).toContain('shell history');
  });

  it('fails with exit code 1 on empty input', () => {
    const result = runScript([], '\n');

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
});
