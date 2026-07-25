export async function ensurePgAdminCredentialSchema(account) {
  const adapter = account?.profiles?.adapter;
  if (!adapter?.query) return false;
  await adapter.query(`
    CREATE TABLE IF NOT EXISTS apg_admin_credentials (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      password JSONB NOT NULL,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await adapter.query('CREATE INDEX IF NOT EXISTS idx_apg_admin_credentials_email ON apg_admin_credentials(email)');
  return true;
}

export async function getPgAdminCredential(account, userId) {
  const adapter = account?.profiles?.adapter;
  if (!adapter?.query || !userId) return null;
  await ensurePgAdminCredentialSchema(account);
  const result = await adapter.query(
    'SELECT user_id, email, password FROM apg_admin_credentials WHERE user_id = $1 LIMIT 1',
    [String(userId)],
  );
  return result.rows?.[0] || null;
}

export async function setPgAdminCredential(account, { userId, email, password, updatedBy = '' } = {}) {
  const adapter = account?.profiles?.adapter;
  if (!adapter?.query || !userId || !password) return null;
  await ensurePgAdminCredentialSchema(account);
  const result = await adapter.query(`
    INSERT INTO apg_admin_credentials (user_id, email, password, updated_by, created_at, updated_at)
    VALUES ($1, $2, $3::jsonb, $4, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      password = EXCLUDED.password,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
    RETURNING user_id, email, updated_by, created_at, updated_at
  `, [
    String(userId),
    String(email || '').trim().toLowerCase(),
    JSON.stringify(password),
    String(updatedBy || ''),
  ]);
  return result.rows?.[0] || null;
}
