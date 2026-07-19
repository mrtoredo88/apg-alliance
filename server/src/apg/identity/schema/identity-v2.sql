CREATE TABLE IF NOT EXISTS apg_identity_users (
  id TEXT PRIMARY KEY,
  canonical_user_id TEXT NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  photo TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  roles JSONB NOT NULL DEFAULT '["user"]'::jsonb,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  legacy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS apg_identity_email_index (
  email TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES apg_identity_users(id) ON DELETE CASCADE,
  canonical_user_id TEXT NOT NULL,
  firebase_uid TEXT,
  legacy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_identity_links (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES apg_identity_users(id) ON DELETE CASCADE,
  canonical_user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS apg_identity_roles (
  user_id TEXT PRIMARY KEY REFERENCES apg_identity_users(id) ON DELETE CASCADE,
  primary_role TEXT NOT NULL DEFAULT 'user',
  roles JSONB NOT NULL DEFAULT '["user"]'::jsonb,
  claims JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_identity_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES apg_identity_users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT,
  device JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS apg_identity_email_otps (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apg_identity_users_email ON apg_identity_users(email);
CREATE INDEX IF NOT EXISTS idx_apg_identity_links_user ON apg_identity_links(user_id);
CREATE INDEX IF NOT EXISTS idx_apg_identity_sessions_user ON apg_identity_sessions(user_id);
