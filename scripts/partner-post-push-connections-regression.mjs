import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cabinet = read('src/cabinet/CabinetCorePage.jsx');
const editor = read('src/workspace/WorkspaceNewsCenter.jsx');
const userApp = read('src/UserApp.jsx');
const profile = read('src/ProfilePanel.jsx');
const server = read('server/src/routes/user-actions.js');

assert.match(cabinet, /label: 'Создать пост'/);
assert.match(cabinet, /openCreateOnMount/);
assert.match(editor, /createPortal/);
assert.match(editor, /formatSelection\('\*\*'\)/);
assert.match(editor, /YouTube, VK Видео, Rutube/);
assert.match(editor, /Добавить публикацию в свой календарь/);
assert.match(editor, />Отмена</);
assert.match(editor, />Черновик</);
assert.match(editor, /Опубликовать/);
assert.match(editor, /safe-area-inset-bottom/);
assert.match(editor, /position: 'sticky'/);

assert.match(profile, /aria-label="Редактировать имя и дату рождения"/);
assert.match(profile, /placeholder="Имя"/);
assert.match(profile, /placeholder="Фамилия"/);
assert.match(profile, /type="date"/);
assert.match(profile, /birthDate: form\.birthDate/);
assert.match(server, /'birthDate'/);
assert.match(server, /INVALID_BIRTH_DATE/);

assert.match(userApp, /user\.notificationsEnabled/);
assert.match(userApp, /Разрешение на уведомления заблокировано/);
assert.match(userApp, /Сервис уведомлений ещё загружается/);
assert.doesNotMatch(userApp, /catch \(e\) \{[\s\S]{0,500}setUser\(prev => prev \? \(\{[\s\S]*notificationsEnabled: false/);

assert.match(server, /const normalizedSenderId = cleanSocialId\(sender\?\.id \|\| senderId\)/);
assert.match(server, /const normalizedRecipientId = cleanSocialId\(recipient\.id\)/);
assert.match(server, /const actorConnectionId = cleanSocialId\(actorProfile\?\.id \|\| actor\.userId\)/);
assert.match(server, /connections:accept/);
assert.match(server, /connections:decline/);
assert.match(server, /connections:cancel/);

console.log('Partner post, push and connections regression passed');
