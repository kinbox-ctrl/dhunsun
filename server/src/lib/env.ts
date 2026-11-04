import { randomBytes } from 'node:crypto';
import path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    if (isProd) throw new Error(`Missing required env var ${name}`);
    const generated = randomBytes(32).toString('hex');
    console.warn(`[env] ${name} not set — using an ephemeral value (sessions reset on restart)`);
    return generated;
  }
  return v;
}

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? path.resolve(process.cwd(), 'data', 'dhunsun.sqlite'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtlSeconds: 15 * 60,
  refreshTtlDays: 30,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  audiusApp: process.env.AUDIUS_APP_NAME ?? 'dhunsun',
  audiusBase: process.env.AUDIUS_BASE ?? 'https://api.audius.co/v1',
};
