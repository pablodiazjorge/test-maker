// Encrypts a question bank for api/get-data.ts in the v2 format:
//   { "v": 2, "algorithm": "aes-256-gcm", "iv", "tag", "data", "createdAt" }
// AES-256-GCM with a random 12-byte IV and a 16-byte tag; iv, tag and data are base64.
//
//   node scripts/encrypt-master-data.mjs [source] [output] [key file]
//
// Defaults, relative to the current directory: public/assets/master-data.json,
// public/assets/master-data.encrypted.json and .secrets/json-decrypt-key.txt.
// JSON_DECRYPT_KEY, when set, is used instead of the key file. The key is read the same way the
// API reads APP_USER_<n>_DECRYPT_KEY: 64 hex characters, base64 of 32 bytes, or 32 UTF-8 bytes.
import { createCipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

const SOURCE_PATH = process.argv[2] ?? 'public/assets/master-data.json';
const OUTPUT_PATH = process.argv[3] ?? 'public/assets/master-data.encrypted.json';
const KEY_FILE_PATH = process.argv[4] ?? '.secrets/json-decrypt-key.txt';

try {
  const sourceAbsolutePath = resolve(process.cwd(), SOURCE_PATH);
  const outputAbsolutePath = resolve(process.cwd(), OUTPUT_PATH);
  const keyFileAbsolutePath = resolve(process.cwd(), KEY_FILE_PATH);

  const rawJson = readFileSync(sourceAbsolutePath, 'utf8');
  JSON.parse(rawJson);

  const keySource = process.env.JSON_DECRYPT_KEY?.trim() || readFileSync(keyFileAbsolutePath, 'utf8').trim();
  const key = resolveKey(keySource);

  // A new random IV on every run: with GCM, reusing an IV with the same key breaks the encryption.
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: GCM_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(rawJson, 'utf8'), cipher.final()]);

  const outputPayload = {
    v: 2,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
    createdAt: new Date().toISOString(),
  };

  mkdirSync(dirname(outputAbsolutePath), { recursive: true });
  writeFileSync(outputAbsolutePath, `${JSON.stringify(outputPayload, null, 2)}\n`, 'utf8');

  console.log(`Encrypted file created: ${outputAbsolutePath}`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to encrypt master data: ${message}`);
  process.exit(1);
}

function resolveKey(keySource) {
  if (/^[a-fA-F0-9]{64}$/.test(keySource)) {
    return Buffer.from(keySource, 'hex');
  }

  if (/^[A-Za-z0-9+/=]+$/.test(keySource)) {
    const base64Buffer = Buffer.from(keySource, 'base64');
    if (base64Buffer.length === 32) {
      return base64Buffer;
    }
  }

  const utf8Buffer = Buffer.from(keySource, 'utf8');
  if (utf8Buffer.length === 32) {
    return utf8Buffer;
  }

  throw new Error('JSON_DECRYPT_KEY must decode to 32 bytes.');
}
