const listeners = new Set();
let currentUser = null;

export const auth = {
  get currentUser() { return currentUser; },
};

export function setNativeAuthUser(user) {
  currentUser = user || null;
  listeners.forEach(listener => listener(currentUser));
}

export function onAuthStateChanged(_auth, handler, errorHandler) {
  listeners.add(handler);
  queueMicrotask(() => {
    try { handler(currentUser); } catch (error) { errorHandler?.(error); }
  });
  return () => listeners.delete(handler);
}

export async function signInAnonymously() {
  return { user: currentUser };
}
