import { analyzeConflicts } from './ConflictAnalyzer.js';
import { buildResolutionManifest } from './ConflictManifest.js';
import { formatConflictCenterReport, formatConflictCard } from './ConflictFormatter.js';
import { validateConflictReport, validateResolutionManifest } from './ConflictValidator.js';

export function buildConflictCenter({ report, manifestPath = '' } = {}) {
  const validation = validateConflictReport(report);
  if (!validation.valid) {
    return {
      ok: false,
      validation,
      analysis: null,
      manifest: null,
      text: validation.errors.join('\n'),
    };
  }
  const analysis = analyzeConflicts(report);
  const manifest = buildResolutionManifest(analysis);
  const manifestValidation = validateResolutionManifest(manifest);
  return {
    ok: manifestValidation.valid,
    validation,
    manifestValidation,
    analysis,
    manifest,
    text: formatConflictCenterReport(analysis, manifestPath),
    cardsText: analysis.conflicts.map(formatConflictCard).join('\n\n'),
  };
}
