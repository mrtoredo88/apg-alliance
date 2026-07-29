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
assert.match(editor, /var\(--apg-vv-bottom, 0px\)\) \+ 10px/, 'news editor actions should not duplicate the full island offset');
assert.match(editor, /position: 'sticky'/);

assert.match(profile, /data-testid="profile-name-edit"/);
assert.match(profile, /data-testid="profile-identity-edit-target"/);
assert.match(profile, /aria-label="Редактировать имя, фамилию и дату рождения"/);
assert.match(profile, /minHeight: 44/);
assert.doesNotMatch(profile, /data-testid="profile-name-edit"[\s\S]{0,500}position: 'absolute'/, 'mobile edit target must not depend on an invisible overlay');
assert.match(profile, /data-testid="desktop-profile-name-edit"/);
assert.match(profile, /data-testid="desktop-profile-pencil-edit"/);
assert.match(profile, /onPointerDown=\{\(\) => setProfileEditInteraction\('mobile-pressed'\)\}/);
assert.match(profile, /onFocus=\{\(\) => setProfileEditInteraction\('mobile-focus'\)\}/);
assert.ok((profile.match(/\{showProfileEditor && createPortal\(/g) || []).length >= 3, 'profile editor must render in desktop, mobile v2 and legacy branches');
assert.match(profile, /user\?\.id \|\| user\?\.userId \|\| user\?\.canonicalUserId \|\| user\?\.uid/, 'profile editor should support every authenticated id shape');
assert.match(profile, /label: 'Настройки профиля',\s+action: \(\) => setShowProfileEditor\(true\)/, 'profile settings should open the editor');
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
