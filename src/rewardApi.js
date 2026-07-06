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
  return postQrToken({ action: 'create', userId, subjectType, subjectId, requestedBy: userId });
}

export function confirmQrScan({ qrValue, scannerUserId }) {
  return postQrToken({ action: 'scan', qrValue, scannerUserId });
}
