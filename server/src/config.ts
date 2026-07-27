import { resolve } from 'node:path';

function readInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(String(process.env[name] ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function readBoolean(name: string, fallback: boolean) {
  const value = String(process.env[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function readList(name: string) {
  return [...new Set(String(process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean))];
}

const nodeEnv = String(process.env.NODE_ENV ?? 'development').trim();
const production = nodeEnv === 'production';
const appOrigin = String(process.env.APP_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, '');

try {
  new URL(appOrigin);
} catch {
  throw new Error('APP_ORIGIN must be a valid absolute URL.');
}

const challengeSecret = String(process.env.CHALLENGE_SECRET ?? (production ? '' : 'development-only-link-challenge-secret')).trim();
if (production && challengeSecret.length < 32) {
  throw new Error('CHALLENGE_SECRET must contain at least 32 characters in production.');
}

export const config = {
  nodeEnv,
  production,
  host: String(process.env.HOST ?? '0.0.0.0'),
  port: readInteger('PORT', 3000, 1, 65535),
  appOrigin,
  databaseUrl: String(process.env.DATABASE_URL ?? 'postgres://link:link@localhost:5432/link'),
  databaseSsl: readBoolean('DATABASE_SSL', false),
  trustProxy: readBoolean('TRUST_PROXY', production),
  cookieSecure: readBoolean('COOKIE_SECURE', production),
  cookieName: String(process.env.SESSION_COOKIE_NAME ?? 'link_session'),
  sessionDays: readInteger('SESSION_DAYS', 30, 1, 180),
  offlineLeaseHours: readInteger('OFFLINE_LEASE_HOURS', 24, 1, 168),
  membershipMaxAgeHours: readInteger('MEMBERSHIP_MAX_AGE_HOURS', 48, 1, 720),
  challengeMinutes: readInteger('CHALLENGE_MINUTES', 5, 1, 30),
  challengeSecret,
  maxDevicesPerUser: readInteger('MAX_DEVICES_PER_USER', 3, 1, 20),
  allowedGroupIds: readList('ALLOWED_QQ_GROUPS'),
  napcatAccessToken: String(process.env.NAPCAT_ACCESS_TOKEN ?? '').trim(),
  adminToken: String(process.env.ADMIN_TOKEN ?? '').trim(),
  staticDir: resolve(process.env.STATIC_DIR ?? 'dist'),
  releaseDir: resolve(process.env.RELEASE_DIR ?? 'releases'),
  accessPagePath: resolve(process.env.ACCESS_PAGE_PATH ?? 'server/public/access.html'),
  allowInsecureUpstreams: readBoolean('ALLOW_INSECURE_UPSTREAMS', !production),
  proxyBodyLimitBytes: readInteger('PROXY_BODY_LIMIT_MB', 24, 1, 128) * 1024 * 1024,
  uploadBodyLimitBytes: readInteger('UPLOAD_BODY_LIMIT_MB', 128, 1, 1024) * 1024 * 1024,
  upstreamTimeoutMs: readInteger('UPSTREAM_TIMEOUT_MS', 45_000, 2_000, 180_000),
  modelRequestTimeoutMs: readInteger('MODEL_REQUEST_TIMEOUT_MS', 600_000, 4_000, 1_200_000),
  groupSyncMinutes: readInteger('GROUP_SYNC_MINUTES', 360, 10, 1440),
  auditRetentionDays: readInteger('AUDIT_RETENTION_DAYS', 90, 7, 730)
} as const;