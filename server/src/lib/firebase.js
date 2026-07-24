import { apgTokenAuth } from './apgTokens.js';
import { postgresDocumentDb } from './postgresDocuments.js';

// Transitional import path retained so existing server modules keep working.
// The implementation contains no Firebase SDK and always uses APG PostgreSQL.
export function getDb() { return postgresDocumentDb; }
export function getDbAuth() { return apgTokenAuth; }
export function getDbMessaging() {
  throw Object.assign(new Error('Firebase Cloud Messaging is disabled; use APG Web Push.'), {
    code: 'APG_FCM_DISABLED',
  });
}
