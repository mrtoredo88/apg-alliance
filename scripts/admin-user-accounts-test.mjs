import assert from 'node:assert/strict';
import {
  buildDuplicateGroups,
  compareUsersForDuplicates,
  mergeUserProfiles,
  normalizeUserEmail,
  normalizeUserPhone,
  normalizeUserTelegram,
} from '../server-shared/admin-user-duplicates.js';

assert.equal(normalizeUserEmail(' USER@Example.COM '), 'user@example.com');
assert.equal(normalizeUserPhone('8 (999) 123-45-67'), '79991234567');
assert.equal(normalizeUserTelegram('@Example_User'), 'example_user');

const users = [
  { id: 'canonical', name: 'Иван Петров', email: 'ivan@example.com', keys: 7, completedTasks: ['a'], visitCounts: { p1: 2 } },
  { id: 'email-copy', displayName: 'Иван Петров', linkedEmail: 'IVAN@example.com', keys: 3, completedTasks: ['b'], visitCounts: { p1: 1, p2: 2 } },
  { id: 'name-copy', name: 'Иван Петрoв', phone: '+7 999 000-00-00' },
  { id: 'other', name: 'Мария Соколова', email: 'maria@example.com' },
];

const exact = compareUsersForDuplicates(users[0], users[1]);
assert.equal(exact.score, 100);
assert.ok(exact.reasons.some(reason => reason.field === 'email'));

const groups = buildDuplicateGroups(users, 70);
assert.equal(groups.length, 1);
assert.deepEqual(groups[0].users.map(user => user.id).sort(), ['canonical', 'email-copy', 'name-copy']);

const merged = mergeUserProfiles(users[0], [users[1]]);
assert.equal(merged.keys, 10);
assert.deepEqual(merged.completedTasks.sort(), ['a', 'b']);
assert.deepEqual(merged.visitCounts, { p1: 3, p2: 2 });
assert.equal(merged.canonicalUserId, 'canonical');
assert.ok(merged.identityAliases.includes('email-copy'));

console.log('admin user accounts tests passed');
