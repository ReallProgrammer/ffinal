import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, hash) {
  const [algorithm, salt, expected] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || expected?.length !== 128) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let value = '';
  for await (const chunk of process.stdin) value += chunk;
  value = value.trimEnd();
  if (value.length < 14)
    throw new Error('Use a unique password of at least 14 characters. Pipe it through stdin.');
  process.stdout.write(passwordHash(value) + '\n');
}
