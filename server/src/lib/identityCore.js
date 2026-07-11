import { FieldValue } from 'firebase-admin/firestore';

const ROLE_ORDER = ['user', 'expert', 'partner', 'analyst', 'moderator', 'editor', 'admin', 'super_admin', 'owner'];
const ADMIN_STATUS_ACTIVE = new Set(['active', 'enabled', '']);

function safeString(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return safeString(value, 220).toLowerCase();
}

function uniq(values = []) {
  return [...new Set(values.map(item => safeString(item, 260)).filter(Boolean))];
}

export function normalizeRole(value) {
  const role = safeString(value, 80).toLowerCase();
  return ROLE_ORDER.includes(role) ? role : '';
}

function roleRank(role) {
  const index = ROLE_ORDER.indexOf(normalizeRole(role) || 'user');
  return index < 0 ? 0 : index;
}

function normalizeRolesFromUser(user = {}) {
  const roles = [
    user.role,
    user.userRole,
    user.authRole,
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.owner === true || user.isOwner === true ? 'owner' : '',
    user.admin === true || user.isAdmin === true ? 'admin' : '',
    user.partnerId || user.partnerCabinetEnabled || (Array.isArray(user.partnerCabinetIds) && user.partnerCabinetIds.length) ? 'partner' : '',
    user.expertId || user.expertCabinetEnabled || (Array.isArray(user.expertCabinetIds) && user.expertCabinetIds.length) ? 'expert' : '',
  ].map(normalizeRole).filter(Boolean);
  return uniq(roles.length ? roles : ['user']);
}

function primaryRole(roles = []) {
  return roles.map(normalizeRole).filter(Boolean).sort((a, b) => roleRank(b) - roleRank(a))[0] || 'user';
}

function statusActive(user = {}) {
  return ADMIN_STATUS_ACTIVE.has(safeString(user.adminStatus || user.status || 'active', 80).toLowerCase());
}

function userScore(item) {
  const roles = normalizeRolesFromUser(item.data);
  const primary = primaryRole(roles);
  const adminBoost = roleRank(primary) >= roleRank('admin') && statusActive(item.data) ? 1000 : 0;
  const canonicalBoost = item.data.canonicalUserId === item.id || item.data.identityStatus === 'canonical' ? 120 : 0;
  const firebaseBoost = item.data.firebaseUid || item.data.authUid || item.id === item.data.uid ? 40 : 0;
  const directEmailPenalty = String(item.id || '').startsWith('email:') ? -10 : 0;
  return adminBoost + canonicalBoost + firebaseBoost + roleRank(primary) * 10 + directEmailPenalty;
}

function publicUser(doc) {
  if (!doc?.exists) return null;
  return { id: doc.id, data: doc.data() || {}, ref: doc.ref };
}

async function getUser(db, id) {
  const safeId = safeString(id, 260);
  if (!safeId) return null;
  const snap = await db.collection('users').doc(safeId).get().catch(() => null);
  return publicUser(snap);
}

async function queryUsers(db, field, op, value, limit = 10) {
  const snap = await db.collection('users').where(field, op, value).limit(limit).get().catch(() => null);
  return snap?.docs?.map(publicUser).filter(Boolean) || [];
}

function mergeUserArrays(candidates, field) {
  return uniq(candidates.flatMap(item => Array.isArray(item.data?.[field]) ? item.data[field] : []));
}

function collectCabinetIds(candidates, singular, plural) {
  return uniq(candidates.flatMap(item => [
    item.data?.[singular],
    ...(Array.isArray(item.data?.[plural]) ? item.data[plural] : []),
  ]));
}

function buildCanonicalPatch({ canonicalId, candidates, email, provider, firebaseUid }) {
  const canonical = candidates.find(item => item.id === canonicalId)?.data || {};
  const roles = uniq([
    ...normalizeRolesFromUser(canonical),
    ...candidates.flatMap(item => normalizeRolesFromUser(item.data)),
  ]);
  const role = primaryRole(roles);
  const linkedEmails = uniq([
    email,
    canonical.email,
    canonical.linkedEmail,
    ...(Array.isArray(canonical.linkedEmails) ? canonical.linkedEmails : []),
    ...candidates.flatMap(item => [item.data?.email, item.data?.linkedEmail, ...(Array.isArray(item.data?.linkedEmails) ? item.data.linkedEmails : [])]),
  ].map(normalizeEmail));
  const identityAliases = uniq([
    canonicalId,
    ...(Array.isArray(canonical.identityAliases) ? canonical.identityAliases : []),
    ...candidates.map(item => item.id),
    firebaseUid,
  ]);
  const partnerCabinetIds = uniq([
    ...mergeUserArrays(candidates, 'partnerCabinetIds'),
    ...collectCabinetIds(candidates, 'partnerId', 'partnerCabinetIds'),
  ]);
  const expertCabinetIds = uniq([
    ...mergeUserArrays(candidates, 'expertCabinetIds'),
    ...collectCabinetIds(candidates, 'expertId', 'expertCabinetIds'),
  ]);
  const linkedAccounts = [
    ...(Array.isArray(canonical.linkedAccounts) ? canonical.linkedAccounts : []),
    ...candidates.map(item => ({ type: String(item.id).startsWith('email:') ? 'email_doc' : 'user_doc', id: item.id })),
    ...(email ? [{ type: 'email', id: email }] : []),
    ...(firebaseUid ? [{ type: 'firebase', id: firebaseUid }] : []),
  ];
  return {
    canonicalUserId: canonicalId,
    identityStatus: 'canonical',
    identityVersion: 'identity-core-v1',
    authProvider: canonical.authProvider || provider || 'identity',
    role,
    userRole: canonical.userRole || role,
    roles,
    linkedEmails,
    identityAliases,
    linkedAccounts: linkedAccounts.slice(-40),
    ...(email && !canonical.email ? { email } : {}),
    ...(firebaseUid ? { firebaseUid } : {}),
    ...(partnerCabinetIds.length ? { partnerCabinetIds, partnerId: canonical.partnerId || partnerCabinetIds[0], partnerCabinetEnabled: true } : {}),
    ...(expertCabinetIds.length ? { expertCabinetIds, expertId: canonical.expertId || expertCabinetIds[0], expertCabinetEnabled: true } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function writeCanonicalSummary(db, { canonicalId, candidates, email, provider, firebaseUid }) {
  const canonical = candidates.find(item => item.id === canonicalId)?.data || {};
  const roles = uniq([...normalizeRolesFromUser(canonical), ...candidates.flatMap(item => normalizeRolesFromUser(item.data))]);
  await db.collection('canonicalUsers').doc(canonicalId).set({
    canonicalUserId: canonicalId,
    primaryUserDocId: canonicalId,
    roles,
    primaryRole: primaryRole(roles),
    linkedEmails: uniq([email, ...(Array.isArray(canonical.linkedEmails) ? canonical.linkedEmails : [])].map(normalizeEmail)),
    linkedFirebaseUids: uniq([firebaseUid, canonical.firebaseUid, canonical.authUid]),
    linkedUserDocIds: uniq(candidates.map(item => item.id)),
    partnerCabinetIds: collectCabinetIds(candidates, 'partnerId', 'partnerCabinetIds'),
    expertCabinetIds: collectCabinetIds(candidates, 'expertId', 'expertCabinetIds'),
    provider: provider || 'identity',
    identityVersion: 'identity-core-v1',
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function linkLegacyDocs(db, canonicalId, candidates) {
  await Promise.all(candidates
    .filter(item => item.id !== canonicalId)
    .map(item => db.collection('users').doc(item.id).set({
      canonicalUserId: canonicalId,
      identityStatus: 'legacy_linked',
      identityVersion: 'identity-core-v1',
      mergedInto: canonicalId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => null)));
}

async function collectEmailCandidates(db, email) {
  const normalized = normalizeEmail(email);
  const ids = [];
  const indexSnap = await db.collection('emailIndex').doc(normalized).get().catch(() => null);
  if (indexSnap?.exists) {
    ids.push(indexSnap.data()?.canonicalUserId, indexSnap.data()?.userId);
  }
  ids.push(`email:${normalized}`);
  const directDocs = await Promise.all(uniq(ids).map(id => getUser(db, id)));
  const queried = [
    ...(await queryUsers(db, 'email', '==', normalized, 10)),
    ...(await queryUsers(db, 'linkedEmail', '==', normalized, 10)),
    ...(await queryUsers(db, 'linkedEmails', 'array-contains', normalized, 10)),
  ];
  const byId = new Map();
  [...directDocs, ...queried].filter(Boolean).forEach(item => byId.set(item.id, item));
  return [...byId.values()];
}

async function createEmailUser(db, email, ref) {
  const userId = `email:${email}`;
  const isValidRef = ref && ref !== userId;
  const today = new Date().toLocaleDateString('sv');
  await db.collection('users').doc(userId).set({
    canonicalUserId: userId,
    identityStatus: 'canonical',
    identityVersion: 'identity-core-v1',
    authProvider: 'email',
    email,
    linkedEmails: [email],
    roles: ['user'],
    role: 'user',
    displayName: email.split('@')[0],
    firstName: email.split('@')[0],
    lastName: null,
    photo: null,
    keys: isValidRef ? 2 : 0,
    favorites: [],
    scannedPartners: {},
    completedTasks: [],
    streak: 0,
    onboardingDone: false,
    scanDates: [],
    lastBonusDate: today,
    referredBy: isValidRef ? ref : null,
    emailVerified: false,
    registeredAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return getUser(db, userId);
}

async function chooseCanonical(candidates) {
  return [...candidates].sort((a, b) => userScore(b) - userScore(a))[0] || null;
}

export function selectCanonicalUserForTest(candidates = []) {
  return [...candidates].sort((a, b) => userScore(b) - userScore(a))[0] || null;
}

export async function resolveEmailIdentity(db, { email, ref = '', firebaseUid = '', createIfMissing = true } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw Object.assign(new Error('Некорректный email.'), { statusCode: 400, code: 'INVALID_EMAIL' });
  let candidates = await collectEmailCandidates(db, normalized);
  if (!candidates.length && createIfMissing) {
    const created = await createEmailUser(db, normalized, ref);
    candidates = created ? [created] : [];
  }
  const canonical = await chooseCanonical(candidates);
  if (!canonical) throw Object.assign(new Error('Пользователь не найден.'), { statusCode: 404, code: 'USER_NOT_FOUND' });
  const canonicalId = canonical.id;
  const patch = buildCanonicalPatch({ canonicalId, candidates, email: normalized, provider: 'email', firebaseUid });
  await db.collection('users').doc(canonicalId).set(patch, { merge: true });
  await db.collection('emailIndex').doc(normalized).set({
    userId: canonicalId,
    canonicalUserId: canonicalId,
    linkedUserDocIds: uniq(candidates.map(item => item.id)),
    identityVersion: 'identity-core-v1',
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection('identityLinks').doc(`email:${normalized}`).set({
    type: 'email',
    value: normalized,
    canonicalUserId: canonicalId,
    userId: canonicalId,
    linkedUserDocIds: uniq(candidates.map(item => item.id)),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await writeCanonicalSummary(db, { canonicalId, candidates, email: normalized, provider: 'email', firebaseUid });
  await linkLegacyDocs(db, canonicalId, candidates);
  const fresh = await getUser(db, canonicalId);
  return {
    canonicalUserId: canonicalId,
    userId: canonicalId,
    user: fresh?.data || canonical.data || {},
    candidates: candidates.map(item => ({ id: item.id, role: item.data?.role || null, userRole: item.data?.userRole || null, identityStatus: item.data?.identityStatus || null })),
    source: candidates.length > 1 ? 'identity_merge' : 'identity_direct',
  };
}

export async function resolveFirebaseIdentity(db, uid) {
  const safeUid = safeString(uid, 260);
  if (!safeUid) return null;
  const direct = await getUser(db, safeUid);
  const directEmail = normalizeEmail(direct?.data?.email || direct?.data?.linkedEmail);
  if (directEmail) {
    const emailIdentity = await resolveEmailIdentity(db, { email: directEmail, firebaseUid: safeUid, createIfMissing: false }).catch(() => null);
    if (emailIdentity?.userId) return { uid: safeUid, userId: emailIdentity.userId, user: emailIdentity.user || {}, source: 'identity_email' };
  }
  const map = await db.collection('auth_map').doc(safeUid).get().catch(() => null);
  const mappedId = map?.exists ? safeString(map.data()?.canonicalUserId || map.data()?.userId || map.data()?.vkId, 260) : '';
  const mapped = mappedId ? await getUser(db, mappedId) : null;
  const byFirebase = await queryUsers(db, 'firebaseUid', '==', safeUid, 5);
  const byAuth = await queryUsers(db, 'authUid', '==', safeUid, 5);
  const candidates = [];
  [direct, mapped, ...byFirebase, ...byAuth].filter(Boolean).forEach(item => {
    if (!candidates.some(row => row.id === item.id)) candidates.push(item);
  });
  const canonical = await chooseCanonical(candidates);
  if (!canonical) return null;
  const canonicalId = safeString(canonical.data?.canonicalUserId || canonical.id, 260);
  await db.collection('auth_map').doc(safeUid).set({
    userId: canonicalId,
    canonicalUserId: canonicalId,
    firebaseUid: safeUid,
    identityVersion: 'identity-core-v1',
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => null);
  return { uid: safeUid, userId: canonicalId, user: canonical.data || {}, source: canonical.id === safeUid ? 'users.uid' : 'identity_core' };
}

export async function buildIdentityDiagnostics(db, { userId = '', email = '', firebaseUid = '' } = {}) {
  const normalizedEmail = normalizeEmail(email);
  const candidates = new Map();
  if (userId) {
    const direct = await getUser(db, userId);
    if (direct) candidates.set(direct.id, direct);
  }
  if (firebaseUid) {
    const resolved = await resolveFirebaseIdentity(db, firebaseUid).catch(() => null);
    if (resolved?.userId) {
      const doc = await getUser(db, resolved.userId);
      if (doc) candidates.set(doc.id, doc);
    }
  }
  if (normalizedEmail) {
    const emailCandidates = await collectEmailCandidates(db, normalizedEmail);
    emailCandidates.forEach(item => candidates.set(item.id, item));
  }
  const list = [...candidates.values()];
  const canonical = await chooseCanonical(list);
  const canonicalId = canonical?.id || '';
  return {
    ok: true,
    canonicalUserId: canonicalId,
    openedUserId: safeString(userId, 260),
    email: normalizedEmail,
    firebaseUid: safeString(firebaseUid, 260),
    roles: canonical ? normalizeRolesFromUser(canonical.data) : [],
    cabinets: canonical ? {
      partnerCabinetIds: collectCabinetIds([canonical], 'partnerId', 'partnerCabinetIds'),
      expertCabinetIds: collectCabinetIds([canonical], 'expertId', 'expertCabinetIds'),
    } : { partnerCabinetIds: [], expertCabinetIds: [] },
    documents: list.map(item => ({
      id: item.id,
      canonicalUserId: item.data?.canonicalUserId || null,
      role: item.data?.role || null,
      userRole: item.data?.userRole || null,
      roles: Array.isArray(item.data?.roles) ? item.data.roles : [],
      identityStatus: item.data?.identityStatus || null,
      score: userScore(item),
    })).sort((a, b) => b.score - a.score),
    reason: canonicalId ? `Identity Core выбрал ${canonicalId} по ролям, статусу и связям.` : 'Canonical User не найден.',
  };
}
