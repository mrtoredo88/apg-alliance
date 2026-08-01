import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPeopleRows } from '../src/social/PeopleCore.js';

const adminSource = await readFile(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8');
const actionsSource = await readFile(new URL('../server/src/routes/user-actions.js', import.meta.url), 'utf8');
const searchBody = actionsSource.slice(
  actionsSource.indexOf('async function actionConnectionsSearch'),
  actionsSource.indexOf('async function actionConnectionsRequest'),
);

const adminActivePredicate = "!user.archived && !user.mergedInto && user.accountStatus !== 'archived'";
const peopleActivePredicate = "!row.archived && !row.mergedInto && row.accountStatus !== 'archived'";

assert.ok(adminSource.includes(adminActivePredicate), 'Admin active-user predicate changed unexpectedly');
assert.ok(searchBody.includes("db.collection('users').limit(1000).get()"), 'People must read the same primary users registry as Admin');
assert.ok(searchBody.includes(peopleActivePredicate), 'People must apply the Admin active-user predicate');
assert.doesNotMatch(searchBody, /searchAccountProfilesForConnections/, 'People must not union account-core aliases into the active list');
assert.doesNotMatch(searchBody, /dedupeSocialSearchRows/, 'People must preserve the primary registry one-to-one');

const rows = buildPeopleRows({
  users: [{ id: 'active-user', displayName: 'Active' }],
  connections: [{ id: 'archived-user', contactUserId: 'archived-user', displayName: 'Archived', status: 'connected' }],
  dialogs: [{ id: 'old-dialog', type: 'direct', objectId: 'historical-user' }],
  actor: { id: 'viewer' },
  restrictToUsers: true,
});
assert.deepEqual(rows.map(row => row.id), ['active-user'], 'Old contacts and dialogs must not add users outside the active registry');

console.log('people active users source regression: ok');
