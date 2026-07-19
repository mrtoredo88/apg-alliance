import { rowData, userEmail, userTelegramId } from './DryRunState.js';

function pass(name, details = {}) {
  return { name, status: 'PASSED', details };
}

function fail(name, details = {}) {
  return { name, status: 'FAILED', details };
}

function warning(name, details = {}) {
  return { name, status: 'WARNING', details };
}

function duplicateValues(rows = [], getter = () => '') {
  const seen = new Map();
  const duplicates = new Map();
  for (const row of rows) {
    const value = getter(row);
    if (!value) continue;
    if (seen.has(value)) duplicates.set(value, [...(duplicates.get(value) || [seen.get(value)]), row.id]);
    else seen.set(value, row.id);
  }
  return [...duplicates.entries()].map(([value, ids]) => ({ value, ids: [...new Set(ids)] }));
}

function userIds(state = {}) {
  return new Set((state.virtualUsers || []).map(row => row.id));
}

function danglingRefs(rows = [], ids = new Set(), fields = []) {
  const broken = [];
  for (const row of rows) {
    const data = rowData(row);
    for (const field of fields) {
      if (data[field] && !ids.has(data[field])) broken.push({ rowId: row.id, field, value: data[field] });
    }
  }
  return broken;
}

export function validateInvariants(state = {}, manifest = {}, diff = {}) {
  const ids = userIds(state);
  const duplicateEmails = duplicateValues(state.virtualUsers || [], userEmail);
  const duplicateTelegramIds = duplicateValues(state.virtualTelegramLinks || [], row => row.id || rowData(row).telegramId || rowData(row).tgId)
    .concat(duplicateValues(state.virtualUsers || [], userTelegramId));
  const orphanTgLinks = (state.virtualTelegramLinks || []).filter(row => {
    const data = rowData(row);
    const target = data.userId || data.canonicalUserId || data.uid;
    return target && !ids.has(target);
  }).map(row => ({ rowId: row.id, target: rowData(row).userId || rowData(row).canonicalUserId || rowData(row).uid }));
  const danglingIdentityReferences = [
    ...danglingRefs(state.virtualIdentityIndex || [], ids, ['userId', 'canonicalUserId', 'uid']),
    ...danglingRefs(state.virtualAuthMap || [], ids, ['userId', 'canonicalUserId', 'uid']),
    ...danglingRefs(state.virtualIdentityLinks || [], ids, ['userId', 'canonicalUserId', 'uid']),
    ...danglingRefs(state.virtualRoles || [], ids, ['userId', 'canonicalUserId', 'uid']),
  ];
  const unresolved = Array.isArray(manifest.unresolvedConflicts) ? manifest.unresolvedConflicts : [];
  const stale = Array.isArray(manifest.staleDecisions) ? manifest.staleDecisions : [];
  const checks = [
    duplicateEmails.length ? fail('no duplicate emails', { count: duplicateEmails.length }) : pass('no duplicate emails'),
    duplicateTelegramIds.length ? fail('no duplicate telegram ids', { count: duplicateTelegramIds.length }) : pass('no duplicate telegram ids'),
    orphanTgLinks.length ? fail('no orphan tgLinks', { count: orphanTgLinks.length }) : pass('no orphan tgLinks'),
    danglingIdentityReferences.length ? fail('no dangling identity references', { count: danglingIdentityReferences.length }) : pass('no dangling identity references'),
    danglingRefs(state.virtualOwnership || [], ids, ['userId', 'ownerId']).length ? fail('no missing owners') : pass('no missing owners'),
    danglingRefs(state.virtualBookings || [], ids, ['userId', 'ownerId']).length ? fail('no broken bookings') : pass('no broken bookings'),
    danglingRefs(state.virtualDialogs || [], ids, ['userId', 'ownerId', 'createdBy']).length ? fail('no broken dialogs') : pass('no broken dialogs'),
    danglingRefs(state.virtualFriends || [], ids, ['userId', 'friendId']).length ? fail('no broken friends') : pass('no broken friends'),
    danglingRefs(state.virtualKeys || [], ids, ['userId', 'ownerId']).length ? fail('no broken keys') : pass('no broken keys'),
    danglingRefs(state.virtualNotifications || [], ids, ['userId', 'ownerId']).length ? fail('no broken notifications') : pass('no broken notifications'),
    danglingRefs(state.virtualRewards || [], ids, ['userId', 'ownerId']).length ? fail('no broken rewards') : pass('no broken rewards'),
    unresolved.length ? fail('no unresolved conflicts', { count: unresolved.length }) : pass('no unresolved conflicts'),
    stale.length ? fail('no stale decisions', { count: stale.length }) : pass('no stale decisions'),
    diff.errors?.length ? fail('diff built without errors', { count: diff.errors.length }) : pass('diff built without errors'),
  ];
  const failed = checks.filter(item => item.status === 'FAILED');
  return {
    status: failed.length ? 'FAILED' : 'PASSED',
    checks,
    duplicateEmails,
    duplicateTelegramIds,
    orphanTgLinks,
    danglingIdentityReferences,
  };
}

export function validatePreservation(before = {}, after = {}) {
  const preserve = ['bookings', 'dialogs', 'friends', 'keys', 'notifications', 'rewards', 'ownership'];
  const checks = preserve.map(name => {
    const previous = Number(before[name] || 0);
    const current = Number(after[name] || 0);
    if (current < previous) return fail(`${name} preserved`, { before: previous, after: current });
    if (current > previous) return warning(`${name} preserved`, { before: previous, after: current });
    return pass(`${name} preserved`, { before: previous, after: current });
  });
  return {
    status: checks.some(item => item.status === 'FAILED') ? 'FAILED' : 'PASSED',
    checks,
  };
}
