import { getCapabilityById } from './CapabilityRegistry.js';

export function validateCapabilityContext(capabilityContext = {}) {
  if (!capabilityContext.capability) return { ok: true, reason: 'empty_capability' };
  if (!getCapabilityById(capabilityContext.capability)) return { ok: false, reason: 'unknown_capability' };
  if (!Number.isFinite(Number(capabilityContext.confidence))) return { ok: false, reason: 'invalid_confidence' };
  if (!Array.isArray(capabilityContext.required)) return { ok: false, reason: 'invalid_required_parameters' };
  if (!Array.isArray(capabilityContext.missing)) return { ok: false, reason: 'invalid_missing_parameters' };
  return { ok: true, reason: '' };
}

export class CapabilityValidator {
  validate(context = {}) {
    return validateCapabilityContext(context);
  }
}
