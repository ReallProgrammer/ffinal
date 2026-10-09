import { Pool } from 'pg';
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { migrate } from './migrations.mjs';
import { configuration } from './config.mjs';
import { createApp } from './app.mjs';
const config = configuration();
const db = new Pool({ connectionString: config.databaseUrl, max: 10 });
await migrate(db);
const s3 = new S3Client({
  region: config.region,
  endpoint: config.endpoint,
  forcePathStyle: config.forcePathStyle,
  credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
});
try {
  await s3.send(new HeadBucketCommand({ Bucket: config.bucket }));
} catch (e) {
  if (process.env.S3_CREATE_BUCKET === 'true' && e.$metadata?.httpStatusCode === 404)
    await s3.send(new CreateBucketCommand({ Bucket: config.bucket }));
  else
    throw new Error(
      'Storage bucket is unavailable. Create a private bucket or set S3_CREATE_BUCKET=true for local development.',
    );
}
const server = createApp({ db, s3, config }).listen(config.port, config.host, () =>
  console.log(`Library API listening on ${config.host}:${config.port}`),
);
async function shutdown() {
  server.close();
  await db.end();
  s3.destroy();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
