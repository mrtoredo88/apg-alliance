import assert from 'node:assert/strict';
import {
  buildDuplicateGroups,
  compareUsersForDuplicates,
  mergeUserProfiles,
  normalizeUserEmail,
  normalizeUserPhone,
  normalizeUserTelegram,
} from '../server-shared/admin-user-duplicates.js';
import {
  findUserReferences,
  USER_REFERENCE_COLLECTIONS,
  USER_REFERENCE_FIELDS,
} from '../server-shared/admin-user-references.js';

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
const splitGroups = buildDuplicateGroups(users, 70, new Set(['canonical|name-copy', 'email-copy|name-copy']));
assert.equal(splitGroups.length, 1);
assert.deepEqual(splitGroups[0].users.map(user => user.id).sort(), ['canonical', 'email-copy']);

const merged = mergeUserProfiles(users[0], [users[1]]);
assert.equal(merged.keys, 10);
assert.deepEqual(merged.completedTasks.sort(), ['a', 'b']);
assert.deepEqual(merged.visitCounts, { p1: 3, p2: 2 });
assert.equal(merged.canonicalUserId, 'canonical');
assert.ok(merged.identityAliases.includes('email-copy'));

const queryCalls = [];
const referenceDocs = {
  'events:userId': [
    { id: 'event-1', data: () => ({ userId: 'email-copy' }) },
    { id: 'event-1', data: () => ({ userId: 'email-copy' }) },
  ],
  'notifications:recipientId': [
    { id: 'notification-1', data: () => ({ recipientId: 'name-copy' }) },
  ],
};
const fakeDb = {
  collection(collection) {
    return {
      where(field, operator, ids) {
        queryCalls.push({ collection, field, operator, ids });
        return {
          limit() {
            return {
              async get() {
                return { docs: referenceDocs[`${collection}:${field}`] || [] };
              },
            };
          },
        };
      },
    };
  },
};
const references = await findUserReferences(fakeDb, ['email-copy', 'name-copy', 'email-copy']);
assert.equal(queryCalls.length, USER_REFERENCE_COLLECTIONS.length * USER_REFERENCE_FIELDS.length);
assert.ok(queryCalls.every(call => call.operator === 'in'));
assert.ok(queryCalls.every(call => call.ids.length === 2));
assert.deepEqual(references.map(item => item.key).sort(), ['events:event-1:userId', 'notifications:notification-1:recipientId']);

const adminPanelSource = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8'));
assert.match(adminPanelSource, /mergeBusyAction === 'preview' \? 'Проверяем связи\.\.\.'/);
assert.match(adminPanelSource, /role="alert"/);
assert.match(adminPanelSource, /Сначала нажмите «Проверить перенос»/);
assert.match(adminPanelSource, /canDeleteUsers && <button/);
assert.match(adminPanelSource, /Изменять роли может только owner/);

const adminActionsSource = await import('node:fs/promises').then(fs => fs.readFile(new URL('../server/src/routes/admin-actions.js', import.meta.url), 'utf8'));
assert.match(adminActionsSource, /Изменять роли и количество ключей пользователей может только owner/);
assert.match(adminActionsSource, /Number\.isSafeInteger\(keys\)/);
assert.match(adminActionsSource, /keys < 0 \|\| keys > 1000000/);
assert.match(adminActionsSource, /Объединённые aliases нельзя восстанавливать отдельно/);
assert.match(adminActionsSource, /Аккаунты изменились после предварительной проверки/);
assert.match(adminActionsSource, /user-accounts:not-duplicate/);
assert.match(adminActionsSource, /user-accounts:split-duplicate/);
assert.match(adminActionsSource, /userMergeSnapshots/);
assert.match(adminActionsSource, /Укажите причину архивирования/);
assert.match(adminActionsSource, /Укажите причину окончательного удаления/);
assert.match(adminActionsSource, /Объединение привилегированных аккаунтов доступно только owner/);

console.log('admin user accounts tests passed');
