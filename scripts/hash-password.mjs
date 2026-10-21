// Prints the value for APP_USER_<n>_PASSWORD_HASH: `scrypt$<salt-base64>$<hash-base64>`.
//
//   node scripts/hash-password.mjs                 asks for the password twice, without echo
//   <command> | node scripts/hash-password.mjs     reads the first line of standard input
//   node scripts/hash-password.mjs 'password'      takes it from the argument (it stays in the shell history)
//
// Only the value goes to standard output, so it can be piped (for example to Set-Clipboard in
// PowerShell). Through npm, use `npm run --silent hash:password` to keep npm's banner out of it.
// The login form trims the password before sending it, so the input is trimmed too.
// The parameters must match api/get-data.ts: Node's scrypt defaults (N = 16384, r = 8, p = 1),
// a random 16-byte salt and a 32-byte key.
import { randomBytes, scryptSync } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCRYPT_KEY_LENGTH = 32;
export const SCRYPT_SALT_LENGTH = 16;

export function hashPassword(password, salt = randomBytes(SCRYPT_SALT_LENGTH)) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('The password must not be empty.');
  }

  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function main(args) {
  let password;
  if (args.length > 0) {
    process.stderr.write('Warning: a password passed as an argument stays in the shell history.\n');
    password = args[0];
  } else if (process.stdin.isTTY) {
    password = await promptHidden('Password: ');
    const confirmation = await promptHidden('Repeat the password: ');
    if (password !== confirmation) {
      throw new Error('The passwords do not match.');
    }
  } else {
    password = await readFirstLineOfStdin();
  }

  process.stdout.write(`${hashPassword(password.trim())}\n`);
}

function promptHidden(question) {
  return new Promise((resolvePromise, rejectPromise) => {
    const { stdin, stderr } = process;
    let value = '';

    const finish = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');
      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise(value);
      }
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          finish();
          return;
        }
        if (char === '\u0003') {
          finish(new Error('Cancelled.'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = Array.from(value).slice(0, -1).join('');
          continue;
        }
        if (char >= ' ') {
          value += char;
        }
      }
    };

    stderr.write(question);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.on('data', onData);
    stdin.resume();
  });
}

async function readFirstLineOfStdin() {
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    data += chunk;
  }
  return data.split(/\r?\n/)[0] ?? '';
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
