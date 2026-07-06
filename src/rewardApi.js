import { API_BASE_URL } from './constants.js';

async function postQrToken(body) {
  const response = await fetch(`${API_BASE_URL}/api/qr-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error || 'Ошибка QR-сервиса');
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function createVisitQrToken({ userId, subjectType, subjectId }) {
  return postQrToken({ action: 'create', userId, subjectType, subjectId, requestedBy: userId })
    .catch((e) => {
      if (e.status && e.status !== 404) throw e;
      const type = subjectType === 'expert' ? 'expert' : 'partner';
      return {
        ok: true,
        legacy: true,
        qrValue: type === 'expert' ? `expert_${subjectId}` : String(subjectId),
        expiresAt: Date.now() + 60_000,
        ttlMs: 60_000,
      };
    });
}

export function confirmQrScan({ qrValue, scannerUserId }) {
  return postQrToken({ action: 'scan', qrValue, scannerUserId });
}
