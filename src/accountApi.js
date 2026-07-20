import { API_BASE_URL } from './constants.js';
import { apgIdentity } from './apg/index.js';
import { getFoundationFlag } from './apg/core/FeatureFlags.js';
import { getPwaVersion } from './pwa/PwaUpdateManager.js';

export async function fetchAccountBootstrap(payload = {}) {
  const current = apgIdentity.getCurrentIdentity();
  if (!current) return null;
  const [token, version] = await Promise.all([apgIdentity.getSessionToken(), getPwaVersion()]);
  const response = await fetch(`${API_BASE_URL}/api/account/bootstrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-Auth': token,
      'X-APG-Version': version,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'Account bootstrap failed.');
    error.code = data.code || 'ACCOUNT_BOOTSTRAP_FAILED';
    error.status = response.status;
    throw error;
  }
  return data;
}

export function shouldUseAccountCoreCanary() {
  try {
    return getFoundationFlag('ACCOUNT_STORAGE') === 'postgres'
      || getFoundationFlag('ACCOUNT_CANARY') === '1'
      || localStorage.getItem('apg_account_canary') === '1'
      || localStorage.getItem('apg_account_storage') === 'postgres';
  } catch {
    return false;
  }
}
