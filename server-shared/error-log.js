import { createHash } from 'node:crypto';

const HISTORY_LIMIT = 50;

function safeText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeStack(value) {
  return safeText(value, 5000)
    .replace(/https?:\/\/[^\s)]+\/assets\/([^\s):]+)-[A-Za-z0-9_-]+\.(js|mjs)/g, 'assets/$1.$2')
    .replace(/:\d+:\d+/g, ':#:#')
    .replace(/\b[0-9a-f]{16,}\b/gi, '<id>');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function inferLevel(payload) {
  const explicit = safeText(payload.level || payload.severity, 20).toLowerCase();
  if (['info', 'warning', 'error', 'critical'].includes(explicit)) return explicit;
  const text = `${payload.message || ''} ${payload.source || ''}`.toLowerCase();
  if (/security|permission|auth|fatal|crash|boundary|data loss|потер/.test(text)) return 'critical';
  if (/timeout|network|offline|warning|предупреж/.test(text)) return 'warning';
  return 'error';
}

export function buildErrorFingerprint(payload = {}) {
  const message = safeText(payload.message || payload.error, 500);
  const source = safeText(payload.source || payload.component, 300);
  const normalizedStack = normalizeStack(payload.stack);
  const stackHash = hash(normalizedStack || `${message}|${source}`);
  return {
    fingerprint: hash(`${message}|${source}|${stackHash}`).slice(0, 40),
    stackHash,
    normalizedStack,
  };
}

export async function upsertErrorLog(db, payload = {}, context = {}, FieldValue) {
  const message = safeText(payload.message || payload.error, 500);
  if (!message) return { ok: false, skipped: true };
  const source = safeText(payload.source || context.source || 'unknown', 300);
  const { fingerprint, stackHash } = buildErrorFingerprint({ ...payload, message, source });
  const ref = db.collection('errorLogs').doc(`err_${fingerprint}`);
  const receivedAt = new Date().toISOString();
  const occurrence = {
    at: receivedAt,
    userId: safeText(payload.userId || context.userId, 180) || null,
    version: safeText(payload.version || payload.build || context.version, 80) || null,
    route: safeText(payload.route || payload.page || payload.url, 300) || null,
    component: safeText(payload.component || source, 300) || null,
    device: safeText(payload.device, 100) || null,
    browser: safeText(payload.browser, 100) || null,
    os: safeText(payload.os, 100) || null,
    action: safeText(payload.action, 160) || null,
  };

  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() || {} : {};
    const history = Array.isArray(current.occurrenceHistory) ? current.occurrenceHistory : [];
    const patch = {
      message,
      stack: safeText(payload.stack, 5000),
      stackHash,
      fingerprint,
      source,
      component: safeText(payload.component || source, 300),
      page: safeText(payload.page || payload.route, 160),
      route: safeText(payload.route || payload.page || payload.url, 300),
      url: safeText(payload.url, 300),
      level: inferLevel(payload),
      severity: inferLevel(payload),
      userId: occurrence.userId,
      device: occurrence.device,
      browser: occurrence.browser,
      os: occurrence.os,
      version: occurrence.version,
      build: safeText(payload.build || payload.version || context.version, 80),
      userAgent: safeText(payload.userAgent || context.userAgent, 300),
      relatedActions: Array.isArray(payload.relatedActions) ? payload.relatedActions.slice(-12) : [],
      occurrenceHistory: [...history, occurrence].slice(-HISTORY_LIMIT),
      occurrences: Math.max(0, Number(current.occurrences || 0)) + 1,
      lastSeen: FieldValue.serverTimestamp(),
      timestamp: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      resolved: false,
      archived: false,
    };
    if (!snapshot.exists) {
      patch.firstSeen = FieldValue.serverTimestamp();
      patch.createdAt = FieldValue.serverTimestamp();
    }
    transaction.set(ref, patch, { merge: true });
  });
  return { ok: true, id: ref.id, fingerprint, stackHash };
}
