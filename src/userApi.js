import { API_BASE_URL } from './constants.js';
import { auth } from './firebase.js';

let versionPromise = null;

function getVersion() {
  if (!versionPromise) {
    versionPromise = fetch('/version.json')
      .then(r => r.json())
      .then(d => d.v || '?')
      .catch(() => '?');
  }
  return versionPromise;
}

export async function userAction(action, payload = {}) {
  const current = auth.currentUser;
  if (!current) {
    const error = new Error('Требуется авторизация.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  const [token, version] = await Promise.all([current.getIdToken(), getVersion()]);
  const response = await fetch(`${API_BASE_URL}/api/user-actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Auth': token,
      'X-APG-Version': version,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'Не удалось выполнить действие.');
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}
