// Transitional module name retained for existing imports. Data and identity are
// now supplied by the APG API and PostgreSQL; no Firebase SDK is loaded.
export { db } from './data/apgDocuments.js';
export { auth } from './auth/apgAuthCompat.js';

export const FIREBASE_CLIENT_DIAGNOSTICS = {
  provider: 'apg-postgres-api',
  projectId: null,
  authDomain: null,
  appId: null,
  emulatorRequested: false,
  emulatorConnected: false,
  emulatorHost: null,
  emulatorPort: null,
  staleAdminEmulatorCleared: false,
  environment: import.meta.env.MODE,
  legacyLabel: true,
};

export async function getMessagingIfSupported() {
  return null;
}
