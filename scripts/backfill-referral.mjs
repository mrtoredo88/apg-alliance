import admin from 'firebase-admin';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const serviceAccount = require('../server/firebase-service-account.json');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const referrerId = process.env.REFERRER_ID || '';
const invitedUserId = process.env.INVITED_USER_ID || '';

if (!referrerId || !invitedUserId || referrerId === invitedUserId) {
  console.error('Usage: REFERRER_ID=<id> INVITED_USER_ID=<id> node scripts/backfill-referral.mjs [--apply]');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const referrerRef = db.collection('users').doc(referrerId);
const invitedRef = db.collection('users').doc(invitedUserId);

const result = await db.runTransaction(async tx => {
  const [referrerSnap, invitedSnap] = await Promise.all([tx.get(referrerRef), tx.get(invitedRef)]);
  if (!referrerSnap.exists) return { ok: false, reason: 'referrer_not_found' };
  if (!invitedSnap.exists) return { ok: false, reason: 'invited_user_not_found' };

  const invited = invitedSnap.data() || {};
  if (invited.referredBy && invited.referredBy !== referrerId) {
    return { ok: false, reason: 'different_referrer_exists', referredBy: invited.referredBy };
  }
  if (invited.referralBonusGranted === true) {
    return { ok: false, reason: 'already_granted', referredBy: invited.referredBy || null };
  }

  const patch = {
    referredBy: referrerId,
    referralBonusGranted: true,
    referralBonusGrantedTo: referrerId,
    referralBonusGrantedAt: FieldValue.serverTimestamp(),
    referralBackfilledAt: FieldValue.serverTimestamp(),
  };
  if (!invited.referredBy) patch.keys = FieldValue.increment(2);

  if (apply) {
    tx.set(invitedRef, patch, { merge: true });
    tx.set(referrerRef, {
      keys: FieldValue.increment(2),
      referralCount: FieldValue.increment(1),
      referralRewardedUsers: FieldValue.arrayUnion(invitedUserId),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return {
    ok: true,
    mode: apply ? 'apply' : 'dry-run',
    referrerId,
    invitedUserId,
    invitedHadReferredBy: invited.referredBy || null,
    invitedWillReceiveKeys: !invited.referredBy,
    referrerWillReceiveKeys: true,
  };
});

console.log(JSON.stringify(result, null, 2));
