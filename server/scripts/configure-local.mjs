import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { passwordHash } from '../src/password.mjs';
// Read from stdin so the owner's password is never a command-line argument or log entry.
try {
  await access('.env');
  throw new Error('.env already exists; preserve and edit it instead.');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const email = process.argv[2];
if (!email || !email.includes('@'))
  throw new Error('Supply the owner email as the first argument.');
let password = '';
for await (const chunk of process.stdin) password += chunk;
password = password.trimEnd();
if (password.length < 14) throw new Error('Use a unique password of at least 14 characters.');
const db = randomBytes(24).toString('hex'),
  key = randomBytes(20).toString('hex'),
  secret = randomBytes(32).toString('hex');
await writeFile(
  '.env',
  `DATABASE_URL=postgresql://library:${db}@127.0.0.1:15432/library\nPOSTGRES_PASSWORD=${db}\nS3_REGION=us-east-1\nS3_BUCKET=personal-library\nS3_ENDPOINT=http://127.0.0.1:19000\nS3_ACCESS_KEY_ID=${key}\nS3_SECRET_ACCESS_KEY=${secret}\nOWNER_EMAIL=${email}\nOWNER_PASSWORD_HASH=${passwordHash(password)}\nFRONTEND_ORIGINS=http://127.0.0.1:5173,http://localhost:5173\nHOST=127.0.0.1\nPORT=8787\nNODE_ENV=development\n`,
  { mode: 0o600 },
);
console.log('Saved local configuration. Password and generated secrets were not printed.');
