// Local S3 protocol emulator for development/integration tests only.
import S3rver from 's3rver';
import AWSAccount from 's3rver/lib/models/account.js';
import { mkdir } from 'node:fs/promises';
if (process.env.NODE_ENV === 'production')
  throw new Error('Use production S3-compatible storage, not the development emulator.');
const directory = process.env.DEV_STORAGE_DIRECTORY || '/workspace/.library-objects';
await mkdir(directory, { recursive: true });
const account = new AWSAccount('library-local', 'Local library development');
account.createKeyPair(process.env.S3_ACCESS_KEY_ID, process.env.S3_SECRET_ACCESS_KEY);
await new S3rver({
  address: '127.0.0.1',
  port: 19000,
  directory,
  silent: true,
  allowMismatchedSignatures: false,
  configureBuckets: [{ name: process.env.S3_BUCKET }],
}).run();
console.log('Development S3 storage listening on loopback port 19000.');
