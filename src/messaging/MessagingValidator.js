import { MESSAGING_DIALOG_TYPES } from './MessagingRegistry.js';

export function validateMessagingDialog(dialog = {}) {
  const issues = [];
  if (!dialog.id && !dialog.dialogId) issues.push('missing-id');
  if (!MESSAGING_DIALOG_TYPES[dialog.type || dialog.context?.type || 'direct']) issues.push('unknown-type');
  if (!dialog.header && !dialog.context) issues.push('missing-header-context');
  return { valid: issues.length === 0, issues };
}

export function validateMessagingState({ dialogs = [] } = {}) {
  const rows = Array.isArray(dialogs) ? dialogs : [];
  const issues = rows.flatMap(dialog => validateMessagingDialog(dialog).issues);
  const ids = rows.map(item => item.id || item.dialogId).filter(Boolean);
  if (ids.length !== new Set(ids).size) issues.push('duplicate-dialog-id');
  return { valid: issues.length === 0, issues };
}
