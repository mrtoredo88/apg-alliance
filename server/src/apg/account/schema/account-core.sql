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

CREATE TABLE IF NOT EXISTS apg_catalog_partners (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_app_documents (
  collection_name TEXT NOT NULL,
  document_id TEXT NOT NULL,
  parent_path TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_name, parent_path, document_id)
);

CREATE INDEX IF NOT EXISTS idx_apg_app_documents_collection_updated
  ON apg_app_documents (collection_name, parent_path, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_apg_catalog_partners_name
  ON apg_catalog_partners ((lower(data->>'name')));

CREATE TABLE IF NOT EXISTS apg_account_metrics (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_economy_operations (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  source_id TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL DEFAULT '',
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apg_economy_visit_rewards (
  user_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  operation_id TEXT NOT NULL REFERENCES apg_economy_operations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS apg_social_connection_requests (
  id TEXT PRIMARY KEY,
  pair_key TEXT NOT NULL UNIQUE,
  sender_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES apg_account_profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  CONSTRAINT apg_social_connection_distinct_users CHECK (sender_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS apg_admin_credentials (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password JSONB NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- The MD flowers card was public before the Firestore cutover but its imported
-- lifecycle flags described a draft. Restore only that known catalog record.
UPDATE apg_app_documents
SET data = data || jsonb_build_object(
      'active', true,
      'archived', false,
      'deleted', false,
      'catalogPublished', true,
      'status', 'published',
      'contentStatus', 'published',
      'lifecycleStatus', 'published',
      'publishedAt', COALESCE(data->'publishedAt', to_jsonb(now())),
      'lifecycle', COALESCE(data->'lifecycle', '{}'::jsonb) || jsonb_build_object(
        'version', 'content-lifecycle-v1',
        'status', 'published',
        'resource', 'partners',
        'updatedBy', 'firestore-cutover-repair'
      )
    ),
    updated_at = now()
WHERE collection_name = 'partners'
  AND parent_path = ''
  AND document_id = 'endo3pMXsQlsBaM2sQFe'
  AND (
    data->>'catalogPublished' = 'false'
    OR data->>'status' = 'draft'
    OR data->>'active' = 'false'
  );

INSERT INTO apg_account_schema_versions (version, checksum, description)
VALUES (
  'catalog-md-flowers-public-2026-07-27',
  'catalog-md-flowers-public-v1',
  'Restore MD flowers public lifecycle flags after Firestore cutover'
)
ON CONFLICT (version) DO NOTHING;

-- Reconcile the owner's canonical balance with the migrated user document.
-- The native-auth cutover initially selected a technical account containing 4
-- keys while the verified migrated profile contains 32.
WITH migrated_owner AS (
  SELECT MAX(
    CASE
      WHEN (data->>'keys') ~ '^[0-9]+$' THEN (data->>'keys')::integer
      ELSE 0
    END
  ) AS keys
  FROM apg_app_documents
  WHERE collection_name = 'users'
    AND parent_path = ''
    AND lower(COALESCE(data->>'email', data->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
    AND NOT EXISTS (
      SELECT 1
      FROM apg_account_schema_versions
      WHERE version = 'owner-keys-reconcile-2026-07-27'
    )
)
UPDATE apg_account_profiles AS profile
SET profile = jsonb_set(
      profile.profile,
      '{keys}',
      to_jsonb(migrated_owner.keys),
      true
    ),
    updated_at = now()
FROM migrated_owner
WHERE migrated_owner.keys = 32
  AND lower(COALESCE(profile.email, profile.profile->>'email', profile.profile->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
  AND CASE
        WHEN (profile.profile->>'keys') ~ '^[0-9]+$' THEN (profile.profile->>'keys')::integer
        ELSE 0
      END <> migrated_owner.keys;

INSERT INTO apg_account_schema_versions (version, checksum, description)
SELECT
  'owner-keys-reconcile-2026-07-27',
  'owner-keys-reconcile-v1',
  'Reconcile owner canonical key balance with the verified migrated profile'
WHERE EXISTS (
  SELECT 1
  FROM apg_app_documents
  WHERE collection_name = 'users'
    AND parent_path = ''
    AND lower(COALESCE(data->>'email', data->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
    AND (data->>'keys') ~ '^[0-9]+$'
    AND (data->>'keys')::integer = 32
)
ON CONFLICT (version) DO NOTHING;

-- The first reconciliation only matched account profiles that already carried
-- the email. Native-auth aliases may have no email in Account Core, although
-- Identity PostgreSQL links them to the same verified address. Reconcile those
-- exact 0/4-key migration artefacts as well, without touching later balances.
WITH verified_balance AS (
  SELECT 32::integer AS keys
  WHERE EXISTS (
    SELECT 1
    FROM apg_app_documents
    WHERE collection_name = 'users'
      AND parent_path = ''
      AND lower(COALESCE(data->>'email', data->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
      AND (data->>'keys') ~ '^[0-9]+$'
      AND (data->>'keys')::integer = 32
  )
    AND NOT EXISTS (
      SELECT 1
      FROM apg_account_schema_versions
      WHERE version = 'owner-canonical-keys-reconcile-2026-07-27'
    )
),
owner_identity_ids AS (
  SELECT id AS user_id
  FROM apg_identity_users
  WHERE lower(COALESCE(email, '')) = 'mrtoredo88@mail.ru'
  UNION
  SELECT canonical_user_id
  FROM apg_identity_users
  WHERE lower(COALESCE(email, '')) = 'mrtoredo88@mail.ru'
    AND canonical_user_id IS NOT NULL
    AND canonical_user_id <> ''
)
UPDATE apg_account_profiles AS account
SET profile = jsonb_set(account.profile, '{keys}', to_jsonb(verified_balance.keys), true),
    updated_at = now()
FROM verified_balance
WHERE (
    account.user_id IN (SELECT user_id FROM owner_identity_ids)
    OR account.canonical_user_id IN (SELECT user_id FROM owner_identity_ids)
  )
  AND CASE
        WHEN (account.profile->>'keys') ~ '^[0-9]+$' THEN (account.profile->>'keys')::integer
        ELSE 0
      END IN (0, 4);

INSERT INTO apg_account_schema_versions (version, checksum, description)
SELECT
  'owner-canonical-keys-reconcile-2026-07-27',
  'owner-canonical-keys-reconcile-v1',
  'Reconcile native-auth aliases with the verified canonical owner balance'
WHERE EXISTS (
  SELECT 1
  FROM apg_app_documents
  WHERE collection_name = 'users'
    AND parent_path = ''
    AND lower(COALESCE(data->>'email', data->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
    AND (data->>'keys') ~ '^[0-9]+$'
    AND (data->>'keys')::integer = 32
)
ON CONFLICT (version) DO NOTHING;

-- Profile synchronization previously copied the stale migrated `keys` field
-- back into Account Core. After economy fields became repository-owned, repair
-- only the exact known 0/4 migration artefacts once more.
WITH verified_balance AS (
  SELECT 32::integer AS keys
  WHERE EXISTS (
    SELECT 1
    FROM apg_app_documents
    WHERE collection_name = 'users'
      AND parent_path = ''
      AND lower(COALESCE(data->>'email', data->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
      AND (data->>'keys') ~ '^[0-9]+$'
      AND (data->>'keys')::integer = 32
  )
    AND NOT EXISTS (
      SELECT 1 FROM apg_account_schema_versions
      WHERE version = 'owner-canonical-keys-reconcile-v2-2026-07-27'
    )
),
owner_identity_ids AS (
  SELECT id AS user_id FROM apg_identity_users
  WHERE lower(COALESCE(email, '')) = 'mrtoredo88@mail.ru'
  UNION
  SELECT canonical_user_id FROM apg_identity_users
  WHERE lower(COALESCE(email, '')) = 'mrtoredo88@mail.ru'
    AND canonical_user_id IS NOT NULL AND canonical_user_id <> ''
)
UPDATE apg_account_profiles AS account
SET profile = jsonb_set(account.profile, '{keys}', to_jsonb(verified_balance.keys), true),
    updated_at = now()
FROM verified_balance
WHERE (
    account.user_id IN (SELECT user_id FROM owner_identity_ids)
    OR account.canonical_user_id IN (SELECT user_id FROM owner_identity_ids)
  )
  AND CASE
        WHEN (account.profile->>'keys') ~ '^[0-9]+$' THEN (account.profile->>'keys')::integer
        ELSE 0
      END IN (0, 4);

INSERT INTO apg_account_schema_versions (version, checksum, description)
SELECT
  'owner-canonical-keys-reconcile-v2-2026-07-27',
  'owner-canonical-keys-reconcile-v2',
  'Repair owner balance after stale profile synchronization was disabled'
WHERE EXISTS (
  SELECT 1 FROM apg_app_documents
  WHERE collection_name = 'users'
    AND parent_path = ''
    AND lower(COALESCE(data->>'email', data->>'linkedEmail', '')) = 'mrtoredo88@mail.ru'
    AND (data->>'keys') ~ '^[0-9]+$'
    AND (data->>'keys')::integer = 32
)
ON CONFLICT (version) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_apg_account_profiles_email ON apg_account_profiles(email);
CREATE INDEX IF NOT EXISTS idx_apg_account_profiles_firebase_uid ON apg_account_profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_apg_account_profiles_telegram_id ON apg_account_profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_apg_account_cabinets_user ON apg_account_cabinets(user_id);
CREATE INDEX IF NOT EXISTS idx_apg_account_cabinets_entity ON apg_account_cabinets(entity_id);
CREATE INDEX IF NOT EXISTS idx_apg_account_sessions_user ON apg_account_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_apg_admin_credentials_email ON apg_admin_credentials(email);
CREATE INDEX IF NOT EXISTS idx_apg_social_connection_sender ON apg_social_connection_requests(sender_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_apg_social_connection_recipient ON apg_social_connection_requests(recipient_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_apg_social_connection_status ON apg_social_connection_requests(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_apg_economy_operations_user_created ON apg_economy_operations(user_id, created_at DESC);
