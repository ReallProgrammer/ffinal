import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { configuration } from '../src/config.mjs';
const env = {
  DATABASE_URL: 'postgresql://localhost/library',
  S3_BUCKET: 'library-test',
  S3_ACCESS_KEY_ID: 'test-access-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
  OWNER_EMAIL: 'owner@example.test',
  OWNER_PASSWORD_HASH: `scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`,
  FRONTEND_ORIGINS: 'https://example.test',
};
test('S3 addressing preserves AWS and local-emulator defaults and rejects typos', () => {
  assert.equal(configuration(env).forcePathStyle, false);
  assert.equal(
    configuration({ ...env, S3_ENDPOINT: 'http://127.0.0.1:19000' }).forcePathStyle,
    true,
  );
  assert.throws(() => configuration({ ...env, S3_FORCE_PATH_STYLE: 'flase' }), /true or false/);
});
for (const style of ['true', 'false']) {
  test(`S3 SDK builds the correct bucket request with S3_FORCE_PATH_STYLE=${style}`, async () => {
    const config = configuration({
      ...env,
      S3_ENDPOINT: 'https://storage.example.test',
      S3_FORCE_PATH_STYLE: style,
    });
    let request;
    const client = new S3Client({
      endpoint: config.endpoint,
      region: 'auto',
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      requestHandler: {
        handle: async (value) => {
          request = value;
          return { response: { statusCode: 200, headers: {}, body: new Uint8Array() } };
        },
      },
    });
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      assert.equal(
        request.hostname,
        style === 'true' ? 'storage.example.test' : 'library-test.storage.example.test',
      );
      assert.equal(request.path, style === 'true' ? '/library-test/' : '/');
    } finally {
      client.destroy();
    }
  });
}
