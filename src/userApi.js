import { API_BASE_URL } from './constants.js';
import { auth } from './firebase.js';
import { getPwaVersion } from './pwa/PwaUpdateManager.js';

export async function userAction(action, payload = {}) {
  const current = auth.currentUser;
  if (!current) {
    const error = new Error('Требуется авторизация.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  const [token, version] = await Promise.all([current.getIdToken(), getPwaVersion()]);
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
    if (response.status === 401 || response.status === 403) error.isAuthError = true;
    throw error;
  }
  return data;
}
