// Восстановление данных, разнесённых по legacy-документам Identity Core.
// Запуск: node scripts/identity-repair.mjs [--dry-run]
import { readFileSync } from 'node:fs';
import { getDb } from '../server/src/lib/firebase.js';
import { dataRichness, shouldMigrateLegacyData, migrateLegacyUserData } from '../server/src/legacy/identity/identityCore.js';

const dryRun = process.argv.includes('--dry-run');
const envFile = new URL('../server/.env', import.meta.url);
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  const env = readFileSync(envFile, 'utf8');
  process.env.FIREBASE_SERVICE_ACCOUNT = env.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m)?.[1]?.trim() || '';
}
const db = getDb();

const users = await db.collection('users').get();
const pairs = [];
users.docs.forEach(doc => {
  const d = doc.data();
  const canonicalId = String(d.mergedInto || d.dataMigratedInto || d.canonicalUserId || '').trim();
  if (!canonicalId || canonicalId === doc.id) return;
  if (!shouldMigrateLegacyData(d)) return;
  pairs.push({ legacyId: doc.id, canonicalId, richness: dataRichness(d), keys: d.keys || 0, referrals: d.referralCount || 0 });
});

console.log(`users: ${users.size}, legacy-документов с неперенесёнными данными: ${pairs.length}`);
for (const pair of pairs) {
  console.log(`→ ${pair.legacyId} → ${pair.canonicalId} | keys: ${pair.keys}, referrals: ${pair.referrals}, richness: ${pair.richness}`);
  if (dryRun) continue;
  const result = await migrateLegacyUserData(db, pair.canonicalId, pair.legacyId);
  console.log('  результат:', JSON.stringify(result));
  const canon = await db.collection('users').doc(pair.canonicalId).get();
  console.log('  canonical теперь:', JSON.stringify({ keys: canon.data()?.keys, referralCount: canon.data()?.referralCount, referralRewardedUsers: canon.data()?.referralRewardedUsers }));
}
if (!pairs.length) console.log('Разнесённых данных не найдено.');
process.exit(0);
