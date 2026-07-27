import { auth } from './nativeAuth.js';

// Совместимые экспорты на время удаления старых имён из компонентов.
// Физическое хранение и сессии работают через PostgreSQL/APG Identity.
export const db = Object.freeze({ provider: 'postgres' });
export { auth };

export const APG_PLATFORM_DIAGNOSTICS = Object.freeze({
  projectId: null,
  authDomain: null,
  appId: null,
  emulatorRequested: false,
  emulatorConnected: false,
  emulatorHost: null,
  emulatorPort: null,
  staleAdminEmulatorCleared: false,
  environment: import.meta.env.MODE,
  provider: 'native-apg',
  storage: 'postgres',
});

export async function getMessagingIfSupported() {
  return null;
}
