import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

async function askMissing(credentials) {
  if (credentials.email && credentials.password) return credentials;
  const rl = createInterface({ input, output });
  try {
    const askPassword = async () => {
      const originalWrite = rl._writeToOutput;
      rl._writeToOutput = function _writeToOutput(value) {
        if (value.includes('Owner password')) originalWrite.call(this, value);
      };
      try {
        return await rl.question('Owner password: ');
      } finally {
        rl._writeToOutput = originalWrite;
        output.write('\n');
      }
    };
    return {
      email: credentials.email || await rl.question('Owner email: '),
      password: credentials.password || await askPassword(),
    };
  } finally {
    rl.close();
  }
}

function requireStrongPassword(password) {
  const value = String(password || '');
  if (value.length < 10 || !/[A-ZА-Я]/.test(value) || !/[a-zа-я]/.test(value) || !/\d/.test(value)) {
    throw new Error('Owner password must be at least 10 chars and include upper/lower letters and a digit.');
  }
  return value;
}

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'server/firebase-service-account.json';
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const { email, password } = await askMissing({
  email: process.env.OWNER_EMAIL,
  password: process.env.OWNER_PASSWORD,
});

const ownerEmail = String(email || '').trim().toLowerCase();
if (!ownerEmail.includes('@')) throw new Error('Owner email is invalid.');
const ownerPassword = requireStrongPassword(password);

const auth = getAuth();
const db = getFirestore();
let record = await auth.getUserByEmail(ownerEmail).catch(() => null);

if (record) {
  record = await auth.updateUser(record.uid, {
    password: ownerPassword,
    emailVerified: true,
    disabled: false,
    displayName: record.displayName || 'Owner APG',
  });
} else {
  record = await auth.createUser({
    email: ownerEmail,
    password: ownerPassword,
    emailVerified: true,
    disabled: false,
    displayName: 'Owner APG',
  });
}

await auth.setCustomUserClaims(record.uid, { role: 'owner', owner: true });

await db.collection('users').doc(record.uid).set({
  firebaseUid: record.uid,
  authUid: record.uid,
  email: ownerEmail,
  login: ownerEmail,
  name: record.displayName || 'Owner APG',
  role: 'owner',
  userRole: 'owner',
  roles: ['owner'],
  adminPermissions: ['*'],
  adminStatus: 'active',
  mustChangePassword: false,
  ownerProtected: true,
  updatedAt: FieldValue.serverTimestamp(),
  createdAt: FieldValue.serverTimestamp(),
}, { merge: true });

await db.collection('adminSecurityLog').add({
  action: 'owner:bootstrap',
  targetId: record.uid,
  actorId: 'bootstrap-script',
  actorUid: 'bootstrap-script',
  actorName: 'Bootstrap Script',
  role: 'system',
  result: 'success',
  details: { email: ownerEmail },
  createdAt: FieldValue.serverTimestamp(),
});

console.log(JSON.stringify({ ok: true, uid: record.uid, email: ownerEmail, role: 'owner' }, null, 2));
