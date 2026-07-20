CREATE TABLE IF NOT EXISTS apg_account_profiles (
  user_id TEXT PRIMARY KEY,
  canonical_user_id TEXT NOT NULL,
  firebase_uid TEXT,
  email TEXT,
  telegram_id TEXT,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  photo TEXT,
  city TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  bootstrap JSONB NOT NULL DEFAULT '{}'::jsonb,
  legacy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS apg_account_roles (
  user_id TEXT PRIMARY KEY REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  primary_role TEXT NOT NULL DEFAULT 'user',
  roles JSONB NOT NULL DEFAULT '["user"]'::jsonb,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  claims JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_account_permissions (
  user_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'account-core',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);

CREATE TABLE IF NOT EXISTS apg_account_cabinets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_account_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  firebase_uid TEXT,
  device JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS apg_account_telegram_links (
  telegram_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  canonical_user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_account_metrics (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_account_schema_versions (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

INSERT INTO apg_account_schema_versions (version, checksum, description)
VALUES ('account-core-v1-2026-07-20', 'account-core-schema-v1', 'APG Account Core PostgreSQL schema')
ON CONFLICT (version) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_apg_account_profiles_email ON apg_account_profiles(email);
CREATE INDEX IF NOT EXISTS idx_apg_account_profiles_firebase_uid ON apg_account_profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_apg_account_profiles_telegram_id ON apg_account_profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_apg_account_cabinets_user ON apg_account_cabinets(user_id);
CREATE INDEX IF NOT EXISTS idx_apg_account_cabinets_entity ON apg_account_cabinets(entity_id);
CREATE INDEX IF NOT EXISTS idx_apg_account_sessions_user ON apg_account_sessions(user_id);
