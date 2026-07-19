import fs from 'node:fs';
import path from 'node:path';

export const REVIEW_DIR = 'backups/identity/reviews';
export const REVIEW_AUDIT_LOG = path.join(REVIEW_DIR, 'identity-review-audit.jsonl');

export function ensureReviewDir() {
  fs.mkdirSync(REVIEW_DIR, { recursive: true });
  return REVIEW_DIR;
}

export function appendReviewAudit(event = {}) {
  ensureReviewDir();
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });
  fs.appendFileSync(REVIEW_AUDIT_LOG, `${line}\n`);
  return REVIEW_AUDIT_LOG;
}
