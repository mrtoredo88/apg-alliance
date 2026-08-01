import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let messaging;

export function getFirebaseMessaging() {
  if (messaging) return messaging;
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } else {
    credential = applicationDefault();
  }
  const app = getApps()[0] || initializeApp({ credential });
  messaging = getMessaging(app);
  return messaging;
}

export function isDeadFcmCode(code = '') {
  return ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(String(code));
}
