import { getDb } from '../lib/firebase.js';
import { adminReplyError, requireAdminPermission } from '../lib/adminSecurity.js';
import { buildReferralMonitoring } from '../../../server-shared/referral-monitoring.js';

function serializeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  return String(value);
}

function serializeReferralEventDoc(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    timestamp: serializeDate(data.timestamp || data.createdAt) || (data.timestampMs ? new Date(Number(data.timestampMs)).toISOString() : null),
    referrerId: String(data.referrerId || ''),
    referredUserId: String(data.referredUserId || ''),
    referralCode: String(data.referralCode || ''),
    referralFlowId: String(data.referralFlowId || ''),
    type: String(data.type || ''),
    status: String(data.status || ''),
    source: String(data.source || ''),
    sessionId: String(data.sessionId || ''),
    deviceId: String(data.deviceId || ''),
    platform: String(data.platform || ''),
    attempt: Number(data.attempt || 1),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
  };
}

function serializeReferralSessionDoc(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    referrerId: String(data.referrerId || data.referralCode || ''),
    referralFlowId: String(data.flowId || data.referralFlowId || ''),
    deviceId: String(data.deviceId || ''),
    platform: String(data.platform || ''),
    source: String(data.source || ''),
    status: String(data.status || 'active'),
    completed: data.completed === true,
    completedAt: serializeDate(data.completedAt || null),
    createdAt: serializeDate(data.createdAt || null),
    expiresAt: serializeDate(data.expiresAt || null),
    authType: String(data.authType || ''),
    userId: String(data.userId || ''),
  };
}

async function readReferralMonitoringInputs(db) {
  let eventSnap = null;
  try {
    eventSnap = await db.collection('referralEvents').orderBy('timestampMs', 'desc').limit(1200).get();
  } catch {
    eventSnap = await db.collection('referralEvents').limit(1200).get().catch(() => ({ docs: [] }));
  }
  let sessionSnap = null;
  try {
    sessionSnap = await db.collection('referralSessions').orderBy('createdAt', 'desc').limit(300).get();
  } catch {
    sessionSnap = await db.collection('referralSessions').limit(300).get().catch(() => ({ docs: [] }));
  }
  return {
    events: (eventSnap.docs || []).map(serializeReferralEventDoc),
    sessions: (sessionSnap.docs || []).map(serializeReferralSessionDoc),
  };
}

export default async function referralMonitoringRoutes(fastify) {
  fastify.get('/api/referral-monitoring/health', async (request, reply) => {
    const db = getDb();
    try {
      const actor = await requireAdminPermission(request, 'stats:read');
      const { events, sessions } = await readReferralMonitoringInputs(db);
      const monitoring = buildReferralMonitoring({ events, sessions });
      return {
        ok: true,
        actor: { id: actor.userId, role: actor.role, authSource: actor.authSource },
        healthScore: monitoring.healthScore,
        successRate: monitoring.summary.successRate,
        activeAlerts: monitoring.summary.openAlerts,
        criticalAlerts: monitoring.summary.critical,
        brokenSessions: monitoring.summary.brokenSessions,
        pendingRecovery: monitoring.summary.recoveryPending,
        pendingRewards: monitoring.summary.rewardPending,
        averageCompletion: monitoring.summary.averageCompletion,
        status: monitoring.status,
        timestamp: monitoring.timestamp,
      };
    } catch (error) {
      return adminReplyError(reply, error);
    }
  });
}
