import { mapProfile, normalizeEmail, safeString } from './AccountRepositoryUtils.js';

export class ProfileRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.name = 'ProfileRepository';
  }

  async get(userId) {
    const result = await this.adapter.query('SELECT * FROM apg_account_profiles WHERE user_id = $1 LIMIT 1', [safeString(userId, 260)]);
    return mapProfile(result.rows[0]);
  }

  async findByEmail(email) {
    const result = await this.adapter.query('SELECT * FROM apg_account_profiles WHERE email = $1 LIMIT 5', [normalizeEmail(email)]);
    return result.rows.map(mapProfile).filter(Boolean);
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
