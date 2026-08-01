import { mapProfile, normalizeEmail, safeString } from './AccountRepositoryUtils.js';

export class ProfileRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'ProfileRepository';
  }

  async get(userId) {
    const result = await this.adapter.query(`
      WITH requested AS (
        SELECT COALESCE(
          (SELECT canonical_user_id FROM apg_identity_users WHERE id = $1 LIMIT 1),
          $1
        ) AS canonical_id
      )
      SELECT *
      FROM apg_account_profiles, requested
      WHERE user_id = requested.canonical_id OR canonical_user_id = requested.canonical_id
      ORDER BY
        (user_id = canonical_user_id) DESC,
        (user_id = requested.canonical_id) DESC,
        updated_at DESC,
        user_id ASC
      LIMIT 1
    `, [safeString(userId, 260)]);
    return mapProfile(result.rows[0]);
  }

  async findByEmail(email) {
    const result = await this.adapter.query('SELECT * FROM apg_account_profiles WHERE email = $1 LIMIT 5', [normalizeEmail(email)]);
    return result.rows.map(mapProfile).filter(Boolean);
  }

  async getMany(userIds = []) {
    const ids = [...new Set(userIds.map(id => safeString(id, 260)).filter(Boolean))];
    if (!ids.length) return [];
    const result = await this.adapter.query(`
      SELECT DISTINCT ON (requested_id) requested_id, profile_row.*
      FROM unnest($1::text[]) AS requested(requested_id)
      JOIN LATERAL (
        WITH canonical AS (
          SELECT COALESCE(
            (SELECT canonical_user_id FROM apg_identity_users WHERE id = requested_id LIMIT 1),
            requested_id
          ) AS canonical_id
        )
        SELECT *
        FROM apg_account_profiles, canonical
        WHERE user_id = canonical.canonical_id OR canonical_user_id = canonical.canonical_id
        ORDER BY
          (user_id = canonical_user_id) DESC,
          (user_id = canonical.canonical_id) DESC,
          updated_at DESC,
          user_id ASC
        LIMIT 1
      ) AS profile_row ON true
      ORDER BY requested_id
    `, [ids]);
    return result.rows.map(row => ({ requestedUserId: row.requested_id, profile: mapProfile(row) }));
  }

  async listActiveCanonical(limit = 1000) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 1000));
    const result = await this.adapter.query(`
      WITH candidates AS (
        SELECT p.user_id, COALESCE(NULLIF(p.canonical_user_id, ''), p.user_id) AS canonical_user_id,
          p.firebase_uid, p.email, p.telegram_id, p.display_name, p.first_name, p.last_name,
          p.photo, p.city, p.profile, p.bootstrap, p.legacy, p.created_at, p.updated_at, p.last_seen_at,
          2 AS source_rank
        FROM apg_account_profiles p
        UNION ALL
        SELECT d.document_id AS user_id,
          COALESCE(NULLIF(d.data->>'canonicalUserId', ''), d.document_id) AS canonical_user_id,
          COALESCE(d.data->>'firebaseUid', d.data->>'authUid') AS firebase_uid,
          COALESCE(d.data->>'email', d.data->>'linkedEmail') AS email,
          COALESCE(d.data->>'telegramId', d.data->>'tgId') AS telegram_id,
          COALESCE(d.data->>'displayName', d.data->>'name') AS display_name,
          COALESCE(d.data->>'firstName', d.data->>'first_name') AS first_name,
          COALESCE(d.data->>'lastName', d.data->>'last_name') AS last_name,
          COALESCE(d.data->>'photo', d.data->>'photo_200', d.data->>'avatar') AS photo,
          d.data->>'city' AS city, d.data AS profile, '{}'::jsonb AS bootstrap, '{}'::jsonb AS legacy,
          d.created_at, d.updated_at, d.updated_at AS last_seen_at, 1 AS source_rank
        FROM apg_app_documents d
        WHERE d.collection_name = 'users' AND d.parent_path = ''
      ), active AS (
        SELECT * FROM candidates
        WHERE lower(COALESCE(profile->>'archived', 'false')) <> 'true'
          AND lower(COALESCE(profile->>'deleted', 'false')) <> 'true'
          AND COALESCE(profile->>'mergedInto', '') = ''
          AND COALESCE(profile->>'dataMigratedInto', '') = ''
          AND lower(COALESCE(profile->>'accountStatus', profile->>'status', profile->>'lifecycleStatus', 'active'))
            NOT IN ('archived', 'deleted', 'blocked', 'banned', 'merged')
      )
      SELECT DISTINCT ON (canonical_user_id) * FROM active
      ORDER BY canonical_user_id, (user_id = canonical_user_id) DESC, source_rank DESC, updated_at DESC NULLS LAST
      LIMIT $1
    `, [safeLimit]);
    return result.rows.map(row => {
      const profile = mapProfile(row);
      if (!profile) return null;
      const canonicalId = profile.canonicalUserId || profile.id;
      return { ...profile, sourceUserId: profile.id, id: canonicalId, userId: canonicalId, canonicalUserId: canonicalId };
    }).filter(Boolean);
  }

  async linkMergedAliases({ targetId, sourceIds = [], profile = {}, actorId = '' } = {}) {
    const canonicalId = safeString(targetId, 260);
    const aliases = [...new Set(sourceIds.map(id => safeString(id, 260)).filter(id => id && id !== canonicalId))];
    if (!canonicalId || !aliases.length) return { targetId: canonicalId, sourceIds: aliases };
    await this.adapter.transaction(async client => {
      const target = await client.query('SELECT id FROM apg_identity_users WHERE id = $1 LIMIT 1', [canonicalId]);
      if (!target.rows[0]) throw Object.assign(new Error('Основной Identity-аккаунт не найден.'), { code: 'CANONICAL_IDENTITY_NOT_FOUND' });
      await client.query(`
        UPDATE apg_identity_users
        SET canonical_user_id = $1,
            profile = profile || $3::jsonb,
            updated_at = now()
        WHERE id = ANY($2::text[])
      `, [canonicalId, aliases, JSON.stringify({ archived: true, accountStatus: 'merged', mergedInto: canonicalId, mergedBy: actorId })]);
      await client.query(`
        UPDATE apg_identity_links
        SET canonical_user_id = $1, updated_at = now()
        WHERE user_id = ANY($2::text[]) OR canonical_user_id = ANY($2::text[])
      `, [canonicalId, aliases]);
      await client.query(`
        UPDATE apg_identity_email_index
        SET canonical_user_id = $1, updated_at = now()
        WHERE user_id = ANY($2::text[]) OR canonical_user_id = ANY($2::text[])
      `, [canonicalId, aliases]);
      await client.query(`
        UPDATE apg_account_telegram_links
        SET canonical_user_id = $1, updated_at = now()
        WHERE user_id = ANY($2::text[]) OR canonical_user_id = ANY($2::text[])
      `, [canonicalId, aliases]);
      await client.query(`
        UPDATE apg_account_profiles
        SET canonical_user_id = $1,
            profile = profile || $3::jsonb,
            updated_at = now()
        WHERE user_id = ANY($2::text[])
      `, [canonicalId, aliases, JSON.stringify({ archived: true, accountStatus: 'merged', mergedInto: canonicalId, mergedBy: actorId })]);
    });
    const current = await this.get(canonicalId);
    const saved = await this.upsert({
      ...(current || {}),
      ...profile,
      id: canonicalId,
      userId: canonicalId,
      canonicalUserId: canonicalId,
      archived: false,
      accountStatus: 'active',
    });
    return { targetId: canonicalId, sourceIds: aliases, profile: saved };
  }

  async upsert(profile = {}) {
    const userId = safeString(profile.userId || profile.id || profile.canonicalUserId, 260);
    if (!userId) throw Object.assign(new Error('Account profile user id is required.'), { code: 'ACCOUNT_PROFILE_ID_REQUIRED' });
    const canonicalUserId = safeString(profile.canonicalUserId || profile.canonical_user_id || userId, 260);
    const payload = { ...profile, id: userId, userId, canonicalUserId };
    const result = await this.adapter.query(`
      INSERT INTO apg_account_profiles (user_id, canonical_user_id, firebase_uid, email, telegram_id, display_name, first_name, last_name, photo, city, profile, bootstrap, legacy, updated_at, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, now(), COALESCE($14::timestamptz, now()))
      ON CONFLICT (user_id) DO UPDATE SET
        canonical_user_id = EXCLUDED.canonical_user_id,
        firebase_uid = COALESCE(EXCLUDED.firebase_uid, apg_account_profiles.firebase_uid),
        email = COALESCE(EXCLUDED.email, apg_account_profiles.email),
        telegram_id = COALESCE(EXCLUDED.telegram_id, apg_account_profiles.telegram_id),
        display_name = COALESCE(EXCLUDED.display_name, apg_account_profiles.display_name),
        first_name = COALESCE(EXCLUDED.first_name, apg_account_profiles.first_name),
        last_name = COALESCE(EXCLUDED.last_name, apg_account_profiles.last_name),
        photo = COALESCE(EXCLUDED.photo, apg_account_profiles.photo),
        city = COALESCE(EXCLUDED.city, apg_account_profiles.city),
        profile = apg_account_profiles.profile || EXCLUDED.profile,
        bootstrap = apg_account_profiles.bootstrap || EXCLUDED.bootstrap,
        legacy = apg_account_profiles.legacy || EXCLUDED.legacy,
        updated_at = now(),
        last_seen_at = COALESCE(EXCLUDED.last_seen_at, apg_account_profiles.last_seen_at)
      RETURNING *
    `, [
      userId,
      canonicalUserId,
      safeString(profile.firebaseUid || profile.authUid || '', 260) || null,
      normalizeEmail(profile.email || profile.linkedEmail || '') || null,
      safeString(profile.telegramId || profile.tgId || '', 120) || null,
      safeString(profile.displayName || profile.name || '', 180) || null,
      safeString(profile.firstName || '', 120) || null,
      safeString(profile.lastName || '', 120) || null,
      safeString(profile.photo || profile.avatar || profile.photo_200 || '', 500) || null,
      safeString(profile.city || '', 120) || null,
      JSON.stringify(payload),
      JSON.stringify(profile.bootstrap || {}),
      JSON.stringify(profile.legacy || {}),
      profile.lastSeenAt || profile.lastSeen || null,
    ]);
    return mapProfile(result.rows[0]);
  }

  async patch(userId, patch = {}) {
    const current = await this.get(userId);
    return this.upsert({ ...(current || { id: userId, userId }), ...patch });
  }
}
