import { markPerformance } from '../performance/index.js';

export const EMAIL_LOGIN_DIAGNOSTICS_KEY = 'apg_email_login_diagnostics';
const MAX_ATTEMPTS = 20;

function hasStorage() {
  return typeof localStorage !== 'undefined';
}

function safeValue(value) {
  if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  try {
    return JSON.stringify(value).slice(0, 600);
  } catch {
    return String(value).slice(0, 600);
  }
}

function normalizeEntry(stage, details = {}) {
  const sanitized = Object.fromEntries(
    Object.entries(details || {}).map(([key, value]) => [key, safeValue(value)]),
  );
  return {
    at: new Date().toISOString(),
    stage,
    ...sanitized,
  };
}

export function readEmailLoginDiagnostics() {
  if (!hasStorage()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(EMAIL_LOGIN_DIAGNOSTICS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_ATTEMPTS) : [];
  } catch {
    return [];
  }
}

export function clearEmailLoginDiagnostics() {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(EMAIL_LOGIN_DIAGNOSTICS_KEY);
  } catch {}
}

export function recordEmailLoginStage(stage, details = {}) {
  const entry = normalizeEntry(stage, details);
  try {
    markPerformance(`email_login_${stage}`, entry, 'email_login');
  } catch {}
  if (!hasStorage()) return entry;
  try {
    const current = readEmailLoginDiagnostics();
    localStorage.setItem(EMAIL_LOGIN_DIAGNOSTICS_KEY, JSON.stringify([...current, entry].slice(-MAX_ATTEMPTS)));
  } catch {}
  return entry;
}

