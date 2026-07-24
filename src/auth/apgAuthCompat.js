import { apgSession } from './apgSession.js';
import { apgIdentity } from '../apg/index.js';

export const auth = {
  get currentUser() { return apgSession.currentUser; },
};

export function onAuthStateChanged(_auth, handler, errorHandler) {
  try {
    return apgSession.subscribe(handler);
  } catch (error) {
    errorHandler?.(error);
    return () => {};
  }
}

export async function signInAnonymously() {
  const user = await apgIdentity.authenticate({ provider: 'anonymous' });
  return { user };
}

export async function signInWithCustomToken(_auth, token) {
  const user = await apgIdentity.authenticate({ provider: 'apgToken', token });
  return { user };
}

export async function signOut() {
  await apgIdentity.invalidateSession();
}
