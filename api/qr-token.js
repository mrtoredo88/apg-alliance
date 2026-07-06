import { getAdminDb } from './_firebase-admin.js';
import { awardVisit, createVisitQrToken } from '../server-shared/reward-service.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (e) {
    return res.status(500).json({ ok: false, code: 'FIREBASE_NOT_CONFIGURED', message: e.message });
  }

  const action = req.body?.action;
  const result = action === 'create'
    ? await createVisitQrToken(db, req.body)
    : action === 'scan'
      ? await awardVisit(db, { qrValue: req.body?.qrValue, scannerUserId: req.body?.scannerUserId })
      : { ok: false, status: 400, code: 'BAD_ACTION', message: 'Неизвестное действие QR' };

  return res.status(result.status ?? (result.ok ? 200 : 400)).json(result);
}
