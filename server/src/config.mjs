export function configuration(env = process.env) {
  const required = [
    'DATABASE_URL',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'OWNER_EMAIL',
    'OWNER_PASSWORD_HASH',
    'FRONTEND_ORIGINS',
  ];
  for (const key of required)
    if (!env[key]) throw new Error(`Missing ${key}. See server/.env.example.`);
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(env.OWNER_PASSWORD_HASH))
    throw new Error('Invalid OWNER_PASSWORD_HASH');
  const origins = env.FRONTEND_ORIGINS.split(',').map((s) => s.trim());
  if (origins.some((s) => !/^https?:\/\//.test(s) || new URL(s).origin !== s))
    throw new Error('FRONTEND_ORIGINS must list exact origins without paths.');
  if (env.NODE_ENV === 'production' && origins.some((s) => !s.startsWith('https://')))
    throw new Error('Production frontend origins require HTTPS.');
  if (env.S3_FORCE_PATH_STYLE && !['true', 'false'].includes(env.S3_FORCE_PATH_STYLE))
    throw new Error('S3_FORCE_PATH_STYLE must be true or false.');
  return {
    databaseUrl: env.DATABASE_URL,
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE
      ? env.S3_FORCE_PATH_STYLE === 'true'
      : Boolean(env.S3_ENDPOINT),
    region: env.S3_REGION || 'us-east-1',
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    ownerEmail: env.OWNER_EMAIL.toLowerCase(),
    passwordHash: env.OWNER_PASSWORD_HASH,
    origins,
    port: Number(env.PORT || 8787),
    host: env.HOST || '127.0.0.1',
    trustProxy: Number(env.TRUST_PROXY_HOPS || 0),
  };
}
