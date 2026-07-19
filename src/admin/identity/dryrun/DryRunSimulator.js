import { createEmptyDiff } from './DryRunDiff.js';
import { rowData } from './DryRunState.js';

const REF_FIELDS = ['userId', 'ownerId', 'createdBy', 'updatedBy', 'targetUserId', 'canonicalUserId', 'profileUserId'];
const ARRAY_REF_FIELDS = ['participants', 'participantIds', 'userIds', 'ownerUserIds', 'friends', 'friendIds'];

function actionDecision(action = {}) {
  return String(action.decision || action.type || '').trim().toUpperCase();
}

function actionSources(action = {}) {
  return [
    ...(Array.isArray(action.sourceIds) ? action.sourceIds : []),
    ...(Array.isArray(action.sources) ? action.sources : []),
    ...(Array.isArray(action.users) ? action.users : []),
  ].filter(Boolean);
}

function actionTarget(action = {}) {
  return action.targetCanonicalId || action.targetUserId || action.target || null;
}

function actionTelegramId(action = {}) {
  return action.tgLinkId || action.telegramId || action.telegramIdHash || action.tgLink || null;
}

function replaceRefs(rows = [], sources = [], target = '', bucket = [], label = '') {
  const sourceSet = new Set(sources);
  for (const row of rows) {
    const data = rowData(row);
    let changed = false;
    for (const field of REF_FIELDS) {
      if (sourceSet.has(data[field])) {
        data[field] = target;
        changed = true;
      }
    }
    for (const field of ARRAY_REF_FIELDS) {
      if (Array.isArray(data[field])) {
        const next = data[field].map(value => sourceSet.has(value) ? target : value);
        if (JSON.stringify(next) !== JSON.stringify(data[field])) {
          data[field] = [...new Set(next)];
          changed = true;
        }
      }
    }
    if (changed) bucket.push({ collection: label, rowId: row.id, target, sources });
  }
}

function mergeUsers(state, action, diff) {
  const target = actionTarget(action);
  const sources = actionSources(action).filter(id => id && id !== target);
  if (!target || !sources.length) {
    diff.warnings.push({ conflictId: action.conflictId, operation: actionDecision(action), reason: 'missing target or sourceIds' });
    return;
  }
  const before = state.virtualUsers.length;
  state.virtualUsers = state.virtualUsers.filter(row => !sources.includes(row.id));
  const removed = before - state.virtualUsers.length;
  diff.usersMerged.push({ conflictId: action.conflictId, target, sources, removed });
  diff.usersRemoved.push(...sources.map(source => ({ conflictId: action.conflictId, userId: source, mergedInto: target })));
  replaceRefs(state.virtualIdentityIndex, sources, target, diff.identityIndexUpdated, 'emailIndex');
  replaceRefs(state.virtualTelegramLinks, sources, target, diff.telegramLinksRemapped, 'tgLinks');
  replaceRefs(state.virtualAuthMap, sources, target, diff.identityIndexUpdated, 'auth_map');
  replaceRefs(state.virtualCanonicalUsers, sources, target, diff.identityIndexUpdated, 'canonicalUsers');
  replaceRefs(state.virtualIdentityLinks, sources, target, diff.identityIndexUpdated, 'identityLinks');
  replaceRefs(state.virtualRoles, sources, target, diff.identityIndexUpdated, 'roles');
  replaceRefs(state.virtualOwnership, sources, target, diff.ownershipTransferred, 'ownership');
  replaceRefs(state.virtualBookings, sources, target, diff.bookingsTransferred, 'bookings');
  replaceRefs(state.virtualFriends, sources, target, diff.friendsTransferred, 'friends');
  replaceRefs(state.virtualKeys, sources, target, diff.keysTransferred, 'keys');
  replaceRefs(state.virtualDialogs, sources, target, diff.dialogsTransferred, 'dialogs');
  replaceRefs(state.virtualNotifications, sources, target, diff.notificationsTransferred, 'notifications');
}

function remapTelegramLink(state, action, diff) {
  const telegramId = actionTelegramId(action);
  const target = actionTarget(action);
  if (!telegramId || !target) {
    diff.warnings.push({ conflictId: action.conflictId, operation: actionDecision(action), reason: 'missing telegram id or targetCanonicalId' });
    return;
  }
  let changed = false;
  for (const row of state.virtualTelegramLinks) {
    if (row.id === telegramId || rowData(row).telegramId === telegramId || rowData(row).tgId === telegramId) {
      row.data = { ...rowData(row), userId: target, canonicalUserId: target };
      changed = true;
      diff.telegramLinksRemapped.push({ conflictId: action.conflictId, telegramId, target });
    }
  }
  if (!changed) diff.warnings.push({ conflictId: action.conflictId, operation: 'REMAP_TG_LINK', reason: 'tgLink not found in virtual state' });
}

function deleteTelegramLink(state, action, diff) {
  const telegramId = actionTelegramId(action);
  if (!telegramId) {
    diff.warnings.push({ conflictId: action.conflictId, operation: actionDecision(action), reason: 'missing telegram id' });
    return;
  }
  const before = state.virtualTelegramLinks.length;
  state.virtualTelegramLinks = state.virtualTelegramLinks.filter(row => row.id !== telegramId && rowData(row).telegramId !== telegramId && rowData(row).tgId !== telegramId);
  const removed = before - state.virtualTelegramLinks.length;
  if (removed) diff.telegramLinksRemoved.push({ conflictId: action.conflictId, telegramId, removed });
  else diff.warnings.push({ conflictId: action.conflictId, operation: 'DELETE_ORPHAN_TG_LINK', reason: 'tgLink not found in virtual state' });
}

export function simulateDryRun(state = {}, manifest = {}) {
  const diff = createEmptyDiff();
  const actions = Array.isArray(manifest.actions) ? manifest.actions : [];
  for (const action of actions) {
    const decision = actionDecision(action);
    state.operations.push({ conflictId: action.conflictId, decision });
    if (decision === 'KEEP_SEPARATE') continue;
    if (decision === 'MERGE_INTO_A' || decision === 'MERGE_INTO_B') mergeUsers(state, action, diff);
    else if (decision === 'REMAP_TG_LINK') remapTelegramLink(state, action, diff);
    else if (decision === 'DELETE_ORPHAN_TG_LINK') deleteTelegramLink(state, action, diff);
    else diff.warnings.push({ conflictId: action.conflictId, operation: decision || 'UNKNOWN', reason: 'unsupported manifest action' });
  }
  diff.warnings.push(...(state.warnings || []));
  diff.errors.push(...(state.errors || []));
  return diff;
}
