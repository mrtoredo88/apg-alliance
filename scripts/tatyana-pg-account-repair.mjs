import fs from 'node:fs';
import { Pool } from 'pg';

const EXECUTE = process.argv.includes('--execute');
const TARGET_USER_ID = 'email:gordeeva.tatyana@mail.ru';
const TARGET_EMAIL = 'gordeeva.tatyana@mail.ru';

function connectionString() {
  const raw = process.env.APG_IDENTITY_DATABASE_URL
    || process.env.IDENTITY_DATABASE_URL
    || process.env.POSTGRES_DATABASE_URL
    || process.env.DATABASE_URL
    || '';
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return raw.replace(/[?&]sslmode=[^&]+/, '');
  }
}

function sslOptions() {
  if (process.env.APG_IDENTITY_PG_SSL === '0') return false;
  const caPath = process.env.APG_YANDEX_CA_PATH || '/app/certs/YandexInternalRootCA.crt';
  if (fs.existsSync(caPath)) return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function uniq(values = []) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function bestText(...values) {
  return values.map(value => String(value || '').trim()).filter(Boolean).sort((a, b) => b.length - a.length)[0] || '';
}

function normalizeRoles(values = []) {
  const roles = uniq(values.flatMap(value => Array.isArray(value) ? value : [value]).map(role => String(role || '').toLowerCase()));
  if (!roles.includes('user')) roles.push('user');
  return roles.includes('super_admin') ? ['super_admin', ...roles.filter(role => role !== 'super_admin')] : roles;
}

function publicRow(row = {}) {
  return {
    userId: row.user_id,
    canonicalUserId: row.canonical_user_id,
    email: row.email,
    displayName: row.display_name,
    hasPhoto: Boolean(row.photo),
    primaryRole: row.primary_role || '',
    roles: parseJson(row.roles, []),
    updatedAt: row.updated_at,
  };
}

async function loadRows(client) {
  const result = await client.query(`
    SELECT p.*, r.primary_role, r.roles, r.permissions, r.claims
    FROM apg_account_profiles p
    LEFT JOIN apg_account_roles r ON r.user_id = p.user_id
    WHERE lower(replace(concat_ws(' ', p.user_id, p.canonical_user_id, p.email, p.display_name, p.first_name, p.last_name, p.profile::text), 'ё', 'е')) LIKE ANY($1::text[])
    ORDER BY p.updated_at DESC NULLS LAST
  `, [['%гордеева%', '%gordeeva%']]);
  return result.rows || [];
}

function buildRepair(rows = []) {
  const target = rows.find(row => row.user_id === TARGET_USER_ID)
    || rows.find(row => String(row.email || '').toLowerCase() === TARGET_EMAIL)
    || rows.find(row => String(row.primary_role || '').toLowerCase() === 'super_admin')
    || rows[0]
    || null;
  if (!target) return null;

  const targetId = TARGET_USER_ID;
  const aliases = uniq(rows.flatMap(row => {
    const profile = parseJson(row.profile, {}) || {};
    return [
      row.user_id,
      row.canonical_user_id,
      profile.userId,
      profile.canonicalUserId,
      ...(Array.isArray(profile.identityAliases) ? profile.identityAliases : []),
      ...(Array.isArray(profile.linkedAccounts) ? profile.linkedAccounts : []),
    ];
  }));
  const allProfiles = rows.map(row => parseJson(row.profile, {}) || {});
  const roles = normalizeRoles(rows.flatMap((row, index) => [
    row.primary_role,
    parseJson(row.roles, []),
    allProfiles[index]?.role,
    allProfiles[index]?.roles,
  ]));
  const permissions = uniq(rows.flatMap(row => parseJson(row.permissions, [])));
  if (roles.includes('super_admin') && !permissions.includes('*')) permissions.push('*');

  const profile = {
    ...Object.assign({}, ...allProfiles),
    id: targetId,
    uid: targetId,
    userId: targetId,
    canonicalUserId: targetId,
    email: TARGET_EMAIL,
    login: TARGET_EMAIL,
    displayName: bestText('Татьяна Гордеева', ...rows.map(row => row.display_name), ...allProfiles.map(item => item.displayName || item.name)),
    firstName: bestText('Татьяна', ...rows.map(row => row.first_name), ...allProfiles.map(item => item.firstName)),
    lastName: bestText('Гордеева', ...rows.map(row => row.last_name), ...allProfiles.map(item => item.lastName)),
    photo: rows.map(row => row.photo).find(Boolean) || allProfiles.map(item => item.photo || item.avatar || item.photo_200).find(Boolean) || '',
    role: roles[0] || 'user',
    userRole: roles[0] || 'user',
    roles,
    identityAliases: aliases,
    linkedAccounts: aliases,
    identityStatus: 'canonical',
    adminStatus: roles.includes('super_admin') ? 'active' : undefined,
    status: 'active',
    mergedAt: new Date().toISOString(),
    mergedBy: 'tatyana-pg-account-repair',
  };

  return {
    targetId,
    sourceIds: uniq(rows.map(row => row.user_id).filter(id => id !== targetId)),
    aliases,
    profile,
    roles,
    permissions,
    claims: {
      admin: roles.some(role => ['owner', 'super_admin', 'admin'].includes(role)),
      owner: roles.includes('owner'),
    },
  };
}

async function applyRepair(client, repair) {
  await client.query('BEGIN');
  try {
    await client.query(`
      INSERT INTO apg_account_profiles (user_id, canonical_user_id, email, display_name, first_name, last_name, photo, profile, bootstrap, legacy, updated_at, last_seen_at)
      VALUES ($1, $1, $2, $3, $4, $5, $6, $7::jsonb, '{}'::jsonb, '{}'::jsonb, now(), now())
      ON CONFLICT (user_id) DO UPDATE SET
        canonical_user_id = EXCLUDED.canonical_user_id,
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        photo = COALESCE(NULLIF(EXCLUDED.photo, ''), apg_account_profiles.photo),
        profile = apg_account_profiles.profile || EXCLUDED.profile,
        updated_at = now(),
        last_seen_at = COALESCE(apg_account_profiles.last_seen_at, now())
    `, [
      repair.targetId,
      TARGET_EMAIL,
      repair.profile.displayName,
      repair.profile.firstName,
      repair.profile.lastName,
      repair.profile.photo,
      JSON.stringify(repair.profile),
    ]);

    await client.query(`
      INSERT INTO apg_account_roles (user_id, primary_role, roles, permissions, claims, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE SET
        primary_role = EXCLUDED.primary_role,
        roles = EXCLUDED.roles,
        permissions = EXCLUDED.permissions,
        claims = EXCLUDED.claims,
        updated_at = now()
    `, [repair.targetId, repair.roles[0] || 'user', JSON.stringify(repair.roles), JSON.stringify(repair.permissions), JSON.stringify(repair.claims)]);

    if (repair.sourceIds.length) {
      await client.query(`
        UPDATE apg_account_profiles
        SET canonical_user_id = $1,
            profile = profile || jsonb_build_object(
              'canonicalUserId', $1,
              'identityStatus', 'legacy_linked',
              'mergedInto', $1,
              'mergedBy', 'tatyana-pg-account-repair'
            ),
            updated_at = now()
        WHERE user_id = ANY($2::text[])
      `, [repair.targetId, repair.sourceIds]);

      await client.query('UPDATE apg_account_telegram_links SET user_id = $1, canonical_user_id = $1, updated_at = now() WHERE user_id = ANY($2::text[])', [repair.targetId, repair.sourceIds]);
      await client.query('UPDATE apg_identity_links SET user_id = $1, canonical_user_id = $1, updated_at = now() WHERE user_id = ANY($2::text[])', [repair.targetId, repair.sourceIds]);
      await client.query('UPDATE apg_identity_users SET canonical_user_id = $1, updated_at = now() WHERE id = ANY($2::text[])', [repair.targetId, repair.sourceIds]);
    }

    await client.query(`
      INSERT INTO apg_identity_users (id, canonical_user_id, display_name, first_name, last_name, photo, email, role, roles, profile, legacy, updated_at, last_seen_at)
      VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, '{}'::jsonb, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        canonical_user_id = EXCLUDED.canonical_user_id,
        display_name = EXCLUDED.display_name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        photo = COALESCE(NULLIF(EXCLUDED.photo, ''), apg_identity_users.photo),
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        roles = EXCLUDED.roles,
        profile = apg_identity_users.profile || EXCLUDED.profile,
        updated_at = now()
    `, [repair.targetId, repair.profile.displayName, repair.profile.firstName, repair.profile.lastName, repair.profile.photo, TARGET_EMAIL, repair.roles[0] || 'user', JSON.stringify(repair.roles), JSON.stringify(repair.profile)]);

    await client.query(`
      INSERT INTO apg_identity_email_index (email, user_id, canonical_user_id, legacy, updated_at)
      VALUES ($1, $2, $2, '{}'::jsonb, now())
      ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, canonical_user_id = EXCLUDED.canonical_user_id, updated_at = now()
    `, [TARGET_EMAIL, repair.targetId]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function main() {
  const raw = connectionString();
  if (!raw) throw new Error('PostgreSQL connection is not configured.');
  const pool = new Pool({ connectionString: raw, ssl: sslOptions() });
  const client = await pool.connect();
  try {
    const before = await loadRows(client);
    const repair = buildRepair(before);
    if (EXECUTE && repair) await applyRepair(client, repair);
    const after = await loadRows(client);
    console.log(JSON.stringify({
      ok: true,
      mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
      targetUserId: repair?.targetId || TARGET_USER_ID,
      beforeCount: before.length,
      afterCount: after.length,
      before: before.map(publicRow),
      after: after.map(publicRow),
      repair: repair ? {
        sourceIds: repair.sourceIds,
        aliases: repair.aliases,
        roles: repair.roles,
        permissionsCount: repair.permissions.length,
      } : null,
      productionChanged: EXECUTE,
      valuesPrinted: false,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error), productionChanged: false, valuesPrinted: false }, null, 2));
  process.exit(1);
});
