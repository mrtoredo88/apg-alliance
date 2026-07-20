import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'server', 'server-shared', 'scripts', 'public'].filter(fs.existsSync);
const OUT_DIR = 'backups/migration';
const OUT_FILE = path.join(OUT_DIR, 'audit-summary-redacted.json');

const OP_PATTERNS = [
  ['firebaseAuthClient', /\bfrom ['"]firebase\/auth['"]|signInAnonymously|signInWithCustomToken|onAuthStateChanged|auth\.currentUser|getAuth\(/],
  ['firebaseAuthAdmin', /firebase-admin\/auth|getDbAuth|createCustomToken|verifyIdToken|setCustomUserClaims|revokeRefreshTokens|generatePasswordResetLink/],
  ['firestoreClient', /\bfrom ['"]firebase\/firestore['"]|initializeFirestore|persistentLocalCache|connectFirestoreEmulator/],
  ['firestoreAdmin', /firebase-admin\/firestore|getDb\(\)|getFirestore|FieldValue/],
  ['firestoreRead', /\.get\(|getDoc\(|getDocs\(|getCountFromServer\(|\.where\(|\.orderBy\(|\.limit\(/],
  ['firestoreWrite', /\.set\(|\.add\(|\.update\(|\.delete\(|setDoc\(|addDoc\(|updateDoc\(|deleteDoc\(|increment\(|serverTimestamp\(/],
  ['firestoreListener', /onSnapshot\(/],
  ['firestoreTransaction', /runTransaction\(|\.runTransaction\(/],
  ['firebaseMessaging', /firebase\/messaging|getMessaging|getDbMessaging|sendEachForMulticast|fcmTokens/],
  ['firebaseToken', /X-Firebase-Auth|getIdToken|createCustomToken|verifyIdToken|signInWithCustomToken|Firebase ID Token/],
  ['firebaseStorage', /Firebase Storage|storageBucket|firebasestorage/],
];

const DOMAIN_RULES = [
  ['Identity', /identity|email-auth|telegram-auth|verify-telegram|auth_map|emailIndex|tgLinks|canonicalUsers|identityLinks|SessionRepository|IdentityRepository|FirebaseIdentity/i],
  ['Users / Profiles', /users|Profile|profile|profile-autosave|profileOwnership/i],
  ['Roles / Permissions', /role|permission|admin-security|admin-login|claims|owner|cabinet/i],
  ['Sessions', /session|telegramAuthSessions|guestSessions|refresh|lastSeen/i],
  ['Partners', /partner|partners|partnership/i],
  ['Partner Locations', /location|locations|address|geo|map/i],
  ['Experts', /expert|experts|expertReviews|expertRotation/i],
  ['Events', /event|events|registrations|schedule/i],
  ['Bookings / Meetings', /booking|bookings|meeting|meetings/i],
  ['CRM / Workspace', /workspace|crm|cabinet|Workspace/i],
  ['Messaging / Dialogs', /dialog|dialogs|message|messaging|conversation/i],
  ['Social Messaging / Requests', /socialMessaging|ConversationRequest|blockedUsers|connections/i],
  ['Connections', /connection|connections|friends|contacts/i],
  ['Referrals', /referral|referredBy|referralSessions|referralEvents/i],
  ['Keys / Rewards', /keys|reward|rewards|prize|prizes|raffle|claims|scan|scans|achievement/i],
  ['Gifts / Promotions', /gift|gifts|promotion|promotions|offers/i],
  ['News / Content', /news|content|banners|lokiKnowledge|publicSubmit|aiImportRequests/i],
  ['Reviews', /review|reviews|expertReviews|newsComments/i],
  ['Favorites / Saved', /favorite|favorites|saved/i],
  ['Notifications / Push', /notification|notifications|push|fcm|messaging/i],
  ['Analytics / Audit', /analytics|diagnostics|errorLogs|adminActivity|audit|stats|log/i],
  ['Uploaded Media', /upload|photo|media|s3|storage/i],
  ['Loki', /loki|Loki|aiProfile|memory/i],
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|jsx|mjs|json|html|txt|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function side(file) {
  if (file.startsWith('src/')) return 'client';
  if (file.startsWith('server/') || file.startsWith('server-shared/')) return 'server';
  if (file.startsWith('scripts/')) return 'script';
  if (file.startsWith('public/')) return 'public';
  return 'unknown';
}

function classifyDomain(file, line) {
  const text = `${file} ${line}`;
  return DOMAIN_RULES.find(([, re]) => re.test(text))?.[0] || 'Unclassified';
}

function criticality(domain, operations, file) {
  if (['Identity', 'Sessions', 'Roles / Permissions'].includes(domain)) return 'P0';
  if (operations.some(op => ['firestoreWrite', 'firebaseToken', 'firebaseAuthAdmin', 'firebaseAuthClient'].includes(op))) return 'P1';
  if (/UserApp|Home|Workspace|Profile|Booking|Messaging|Rewards|Scanner/.test(file)) return 'P1';
  return 'P2';
}

function scenario(domain, file) {
  if (domain === 'Identity') return 'email/telegram/admin login and identity resolution';
  if (domain === 'Users / Profiles') return 'profile load/edit and session restore context';
  if (domain === 'Partners') return 'home/catalog/partner page/workspace partner cabinet';
  if (domain === 'Experts') return 'expert catalog/profile/cabinet';
  if (domain === 'Events') return 'events list/detail/registration';
  if (domain === 'Bookings / Meetings') return 'booking, meetings and workspace CRM';
  if (domain.includes('Messaging')) return 'messages/dialog list/context chats';
  if (domain.includes('Rewards') || domain.includes('Keys')) return 'keys, scans, rewards, gifts';
  if (domain === 'News / Content') return 'home/news/content studio';
  if (domain === 'Notifications / Push') return 'push registration/send/read notifications';
  if (file.startsWith('scripts/')) return 'maintenance, diagnostics or migration tooling';
  return 'application flow';
}

const findings = [];
for (const file of ROOTS.flatMap(walk).sort()) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const operations = OP_PATTERNS.filter(([, re]) => re.test(line)).map(([name]) => name);
    if (!operations.length) return;
    const domain = classifyDomain(file, line);
    findings.push({
      file,
      line: index + 1,
      side: side(file),
      domain,
      operations,
      operationType: operations.some(op => /Write|Transaction/.test(op)) ? 'write' : operations.some(op => /Auth|Token/.test(op)) ? 'auth' : operations.some(op => /Listener/.test(op)) ? 'listener' : 'read',
      scenario: scenario(domain, file),
      criticality: criticality(domain, operations, file),
      blocksUi: file.startsWith('src/') && /UserApp|Profile|Workspace|Rewards|Partner|Expert|Leaderboard|diagnostics|errorLogger/.test(file),
      breaksAuth: domain === 'Identity' || operations.some(op => /Auth|Token/.test(op)),
      postgresEquivalent: domain === 'Identity' ? 'implemented for Identity v2' : 'not implemented as domain repository yet',
      fallback: domain === 'Identity' ? 'PostgreSQL primary with Firestore emergency fallback after cutover' : 'mostly Firestore/browser cache fallback only',
      resourceExhausted: domain === 'Identity' ? 'should not affect normal login path after cutover' : 'may fail reads/writes/listeners depending on path',
      timeout: 'may surface as empty data, fallback UI, retry, or generic error depending on caller',
      firebaseAbsent: domain === 'Identity' ? 'Firebase Auth provider still required for custom token/session compatibility' : 'critical scenarios can degrade or fail where Firestore remains hard dependency',
    });
  });
}

const byDomain = {};
const byFile = {};
const byOperation = {};
for (const item of findings) {
  byDomain[item.domain] ||= { total: 0, reads: 0, writes: 0, listeners: 0, auth: 0, files: new Set(), criticality: item.criticality };
  byDomain[item.domain].total += 1;
  byDomain[item.domain].files.add(item.file);
  if (item.operations.some(op => /Read|firestoreAdmin|firestoreClient/.test(op))) byDomain[item.domain].reads += 1;
  if (item.operations.some(op => /Write|Transaction/.test(op))) byDomain[item.domain].writes += 1;
  if (item.operations.includes('firestoreListener')) byDomain[item.domain].listeners += 1;
  if (item.operations.some(op => /Auth|Token/.test(op))) byDomain[item.domain].auth += 1;
  byFile[item.file] ||= { total: 0, domains: new Set(), operations: new Set(), side: item.side, criticality: item.criticality };
  byFile[item.file].total += 1;
  byFile[item.file].domains.add(item.domain);
  item.operations.forEach(op => {
    byFile[item.file].operations.add(op);
    byOperation[op] = (byOperation[op] || 0) + 1;
  });
}

const domains = Object.fromEntries(Object.entries(byDomain).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, {
  ...value,
  files: [...value.files].sort(),
}]));
const files = Object.fromEntries(Object.entries(byFile).sort((a, b) => b[1].total - a[1].total).map(([key, value]) => [key, {
  ...value,
  domains: [...value.domains].sort(),
  operations: [...value.operations].sort(),
}]));

const summary = {
  version: 1,
  generatedAt: new Date().toISOString(),
  mode: 'read_only_static_firebase_firestore_dependency_audit',
  roots: ROOTS,
  totals: {
    findings: findings.length,
    filesWithDependencies: Object.keys(files).length,
    directFirestoreReads: findings.filter(item => item.operations.some(op => op === 'firestoreRead' || op === 'firestoreAdmin' || op === 'firestoreClient')).length,
    firestoreWrites: findings.filter(item => item.operations.some(op => op === 'firestoreWrite' || op === 'firestoreTransaction')).length,
    realtimeListeners: findings.filter(item => item.operations.includes('firestoreListener')).length,
    firebaseAuthDependencies: findings.filter(item => item.operations.some(op => /Auth|Token/.test(op))).length,
    p0Findings: findings.filter(item => item.criticality === 'P0').length,
    p1Findings: findings.filter(item => item.criticality === 'P1').length,
  },
  operations: byOperation,
  domains,
  topFiles: Object.entries(files).slice(0, 30).map(([file, value]) => ({ file, ...value })),
  criticalFindings: findings.filter(item => item.criticality !== 'P2').slice(0, 250),
  notes: [
    'Counts are static-code findings, not runtime call volume.',
    'Line snippets are intentionally omitted to avoid leaking personal data from local artifacts.',
    'The api/ directory is absent in this checkout; Fastify server/src/routes is the active backend surface.',
    'No production service was called by this audit script.',
  ],
  safety: {
    productionChanged: false,
    firestoreWritten: false,
    featureFlagsChanged: false,
    migrationStarted: false,
    deployStarted: false,
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  report: OUT_FILE,
  totals: summary.totals,
  topFiles: summary.topFiles.slice(0, 10).map(item => ({ file: item.file, total: item.total, domains: item.domains })),
}, null, 2));
