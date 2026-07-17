import admin from 'firebase-admin';
import { createRequire } from 'node:module';
import { buildReferralRecoveryScanPlan, summarizeReferralRecoveryPlan } from '../server-shared/referral-state-recovery.js';

const require = createRequire(import.meta.url);
const serviceAccount = require('../server/firebase-service-account.json');

const referrerId = process.env.REFERRER_ID || process.argv.find(arg => arg.startsWith('--referrer='))?.split('=')[1] || '';
if (!referrerId) {
  console.error('Usage: REFERRER_ID=<id> node scripts/referral-recovery-audit.mjs');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

function serializeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function userPublicSnapshot(id, user = {}) {
  return {
    id,
    referredBy: user.referredBy || null,
    referralBonusGranted: user.referralBonusGranted === true,
    referralBonusGrantedTo: user.referralBonusGrantedTo || null,
    registeredAt: serializeDate(user.registeredAt || user.createdAt),
    lastSeen: serializeDate(user.lastSeen),
    keys: Number(user.keys || 0),
    referralCount: Number(user.referralCount || 0),
    referralKeys: Number(user.referralKeys || 0),
    referralRewardedUsersCount: Array.isArray(user.referralRewardedUsers) ? user.referralRewardedUsers.length : 0,
  };
}

async function getDocsSafe(query) {
  const snap = await query.get().catch(error => ({ docs: [], error }));
  return { docs: snap.docs || [], error: snap.error || null };
}

const referrerSnap = await db.collection('users').doc(referrerId).get();
const referrer = referrerSnap.exists ? { id: referrerSnap.id, ...(referrerSnap.data() || {}) } : null;

const [byReferred, byGrantedTo, eventsByReferrer, eventsByCode] = await Promise.all([
  getDocsSafe(db.collection('users').where('referredBy', '==', referrerId).limit(500)),
  getDocsSafe(db.collection('users').where('referralBonusGrantedTo', '==', referrerId).limit(500)),
  getDocsSafe(db.collection('referralEvents').where('referrerId', '==', referrerId).limit(500)),
  getDocsSafe(db.collection('referralEvents').where('referralCode', '==', referrerId).limit(500)),
]);

const users = new Map();
[...byReferred.docs, ...byGrantedTo.docs].forEach(doc => users.set(doc.id, { id: doc.id, ...(doc.data() || {}) }));
const userList = [...users.values()];
const plan = buildReferralRecoveryScanPlan({ referrerId, referrer: referrer || {}, invitedUsers: userList });
const eventIds = new Set();
const events = [...eventsByReferrer.docs, ...eventsByCode.docs]
  .filter(doc => {
    if (eventIds.has(doc.id)) return false;
    eventIds.add(doc.id);
    return true;
  })
  .map(doc => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      type: data.type || '',
      status: data.status || '',
      referralFlowId: data.referralFlowId || '',
      referrerId: data.referrerId || '',
      referredUserId: data.referredUserId || '',
      referralCode: data.referralCode || '',
      timestamp: serializeDate(data.createdAt) || data.timestamp || null,
      source: data.source || '',
    };
  })
  .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

const output = {
  referrerId,
  mode: 'read-only',
  referrerExists: !!referrer,
  referrer: referrer ? userPublicSnapshot(referrer.id, referrer) : null,
  usersWithReferredBy: byReferred.docs.length,
  usersWithReferralBonusGrantedTo: byGrantedTo.docs.length,
  uniqueCandidateUsers: userList.length,
  users: userList.map(user => userPublicSnapshot(user.id, user)),
  plan,
  summary: summarizeReferralRecoveryPlan(plan),
  referralEventsCount: events.length,
  referralEvents: events.slice(-80),
  queryErrors: [byReferred.error, byGrantedTo.error, eventsByReferrer.error, eventsByCode.error].filter(Boolean).map(error => error.message || String(error)),
};

console.log(JSON.stringify(output, null, 2));
