import pg, { type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 12,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined
});

export async function query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<Row>> {
  return await pool.query<Row>(text, values);
}

export async function transaction<T>(task: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await task(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migrateDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      qq TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS allowed_groups (
      group_id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS memberships (
      qq TEXT NOT NULL REFERENCES users(qq) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES allowed_groups(group_id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      role TEXT NOT NULL DEFAULT 'member',
      nickname TEXT NOT NULL DEFAULT '',
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (qq, group_id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      qq TEXT NOT NULL REFERENCES users(qq) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      UNIQUE (qq, id)
    );

    CREATE TABLE IF NOT EXISTS login_challenges (
      id UUID PRIMARY KEY,
      qq TEXT NOT NULL,
      code_hash TEXT NOT NULL UNIQUE,
      poll_token_hash TEXT NOT NULL UNIQUE,
      device_id TEXT NOT NULL,
      device_label TEXT NOT NULL DEFAULT '',
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ,
      consumed_at TIMESTAMPTZ,
      error TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      qq TEXT NOT NULL REFERENCES users(qq) ON DELETE CASCADE,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS releases (
      id UUID PRIMARY KEY,
      platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'desktop-macos', 'desktop-windows')),
      version_code INTEGER NOT NULL,
      version_name TEXT NOT NULL,
      minimum_version_code INTEGER NOT NULL DEFAULT 1,
      file_name TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      published BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (platform, version_code)
    );

    CREATE TABLE IF NOT EXISTS release_source_tokens (
      token_hash TEXT PRIMARY KEY,
      qq TEXT NOT NULL REFERENCES users(qq) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      qq TEXT,
      action TEXT NOT NULL,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_hash TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS memberships_active_idx ON memberships (qq, active, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token_hash) WHERE revoked_at IS NULL;
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (qq, expires_at DESC);
    CREATE INDEX IF NOT EXISTS challenges_expiry_idx ON login_challenges (expires_at);
    CREATE INDEX IF NOT EXISTS releases_latest_idx ON releases (platform, published, version_code DESC);
    CREATE INDEX IF NOT EXISTS release_source_tokens_user_idx ON release_source_tokens (qq, expires_at DESC) WHERE revoked_at IS NULL;
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'releases'::regclass
          AND conname = 'releases_platform_check'
          AND pg_get_constraintdef(oid) LIKE '%desktop-macos%'
      ) THEN
        ALTER TABLE releases DROP CONSTRAINT IF EXISTS releases_platform_check;
        ALTER TABLE releases ADD CONSTRAINT releases_platform_check
          CHECK (platform IN ('android', 'ios', 'desktop-macos', 'desktop-windows'));
      END IF;
    END $$;
  `);

  for (const groupId of config.allowedGroupIds) {
    await query(`
      INSERT INTO allowed_groups (group_id, enabled)
      VALUES ($1, TRUE)
      ON CONFLICT (group_id) DO UPDATE SET enabled = TRUE, updated_at = NOW()
    `, [groupId]);
  }
}

export async function closeDatabase() {
  await pool.end();
}