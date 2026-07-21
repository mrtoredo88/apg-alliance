import assert from 'node:assert/strict';
import {
  buildCanonicalPatch,
  buildLegacyMergePatch,
  dataRichness,
  normalizeRole,
  selectCanonicalUserForTest,
  shouldMigrateLegacyData,
} from '../server/src/legacy/identity/identityCore.js';
import { canUseDesktopWorkspace, DESKTOP_WORKSPACE_FLAG, getWorkspaceUserRoles } from '../src/workspace/WorkspaceFeatureFlags.js';

assert.equal(normalizeRole('OWNER'), 'owner');
assert.equal(normalizeRole('unknown'), '');

const ownerDoc = {
  id: 'firebase-owner-uid',
  data: {
    email: 'owner@example.com',
    role: 'owner',
    userRole: 'owner',
    adminStatus: 'active',
    firebaseUid: 'firebase-owner-uid',
  },
};

const legacyEmailPartner = {
  id: 'email:owner@example.com',
  data: {
    email: 'owner@example.com',
    role: 'partner',
    partnerId: 'partner-1',
  },
};

const selected = selectCanonicalUserForTest([legacyEmailPartner, ownerDoc]);
assert.equal(selected.id, 'firebase-owner-uid');

const roles = getWorkspaceUserRoles({
  user: {
    id: selected.id,
    role: selected.data.role,
    userRole: selected.data.userRole,
    roles: ['owner', 'partner'],
  },
});
assert.ok(roles.includes('owner'));
assert.ok(roles.includes('partner'));
assert.equal(canUseDesktopWorkspace({ user: { id: '988504' }, flag: DESKTOP_WORKSPACE_FLAG.owner }), false);
assert.equal(canUseDesktopWorkspace({ user: { id: selected.id, roles }, flag: DESKTOP_WORKSPACE_FLAG.owner }), true);

// ════════════════════════════════════════════════════════════════════
// ПОСТОЯННЫЙ REGRESSION: кейс «16 → 9» (Ольга Крутикова / Дарья Самарина, 2026-07-12).
// Email-документ с реальными данными (16 ключей, 2 реферала) и пустой TG-документ.
// Identity Core обязан: не выбирать пустой документ каноническим, не терять
// ключи/рефералов/роли при слиянии, не создавать альтернативных состояний.
// Запускается при каждом изменении Identity Core (npm run test:identity).
// ════════════════════════════════════════════════════════════════════

const emailDocWithData = {
  id: 'email:case16@mail.ru',
  data: {
    email: 'case16@mail.ru',
    authProvider: 'email',
    emailVerified: true,
    keys: 16,
    reputation: 16,
    referralCount: 2,
    favorites: ['partner-a'],
    completedTasks: ['first_open', 'fav_1', 'referral_1'],
    lastBonusDate: '2026-07-11',
    registeredAt: '2026-07-05T00:00:00.000Z',
  },
};
const emptyTgDoc = {
  id: 'tg_case16',
  data: {
    authProvider: 'telegram',
    linkedEmail: 'case16@mail.ru',
    keys: 9,
    reputation: 6,
    favorites: ['partner-a'],
    completedTasks: ['first_open'],
    lastBonusDate: '2026-07-12',
    registeredAt: '2026-07-01T00:00:00.000Z',
  },
};

// 1. Свежая пара: каноническим становится документ с данными, а не пустой TG
const canonicalFresh = selectCanonicalUserForTest([emptyTgDoc, emailDocWithData]);
assert.equal(canonicalFresh.id, 'email:case16@mail.ru', 'документ с данными должен побеждать пустой TG-док');

// 2. Continuity: уже выбранный канонический документ не переизбирается
const tgAlreadyCanonical = { ...emptyTgDoc, data: { ...emptyTgDoc.data, identityStatus: 'canonical', canonicalUserId: 'tg_case16' } };
const canonicalSticky = selectCanonicalUserForTest([tgAlreadyCanonical, emailDocWithData]);
assert.equal(canonicalSticky.id, 'tg_case16', 'canonical-статус должен сохраняться между входами');

// 3. Слияние не теряет ни одного ключа и реферала (в любом направлении)
const mergeIntoTg = buildLegacyMergePatch(emptyTgDoc.data, emailDocWithData.data);
assert.equal(mergeIntoTg.keys, 25, 'ключи суммируются: 9 + 16 = 25');
assert.equal(mergeIntoTg.referralCount, 2, 'рефералы переносятся');
assert.equal(mergeIntoTg.emailVerified, true, 'подтверждение email не теряется');
assert.deepEqual(mergeIntoTg.completedTasks.sort(), ['fav_1', 'first_open', 'referral_1'], 'задания объединяются без дублей');
assert.deepEqual(mergeIntoTg.favorites, ['partner-a'], 'избранное объединяется без дублей');
assert.equal(mergeIntoTg.lastBonusDate, undefined, 'поздний бонус-день канонического сохраняется (без двойного бонуса)');
assert.equal(mergeIntoTg.registeredAt, undefined, 'ранняя дата регистрации канонического сохраняется');
const mergeIntoEmail = buildLegacyMergePatch(emailDocWithData.data, emptyTgDoc.data);
assert.equal(mergeIntoEmail.keys, 25, 'сумма ключей не зависит от направления слияния');
assert.equal(mergeIntoEmail.lastBonusDate, '2026-07-12', 'берётся максимальная дата бонуса');
assert.equal(mergeIntoEmail.registeredAt, '2026-07-01T00:00:00.000Z', 'берётся ранняя дата регистрации');

// 4. Идемпотентность: перенесённый legacy-документ не мигрирует повторно
assert.equal(shouldMigrateLegacyData({ keys: 16, dataMigratedInto: 'tg_case16' }), false, 'повторный перенос запрещён');
assert.equal(shouldMigrateLegacyData({ keys: 0, referralCount: 0, favorites: [] }), false, 'пустой документ не требует переноса');
assert.equal(shouldMigrateLegacyData(emailDocWithData.data), true, 'документ с данными требует переноса');

// 5. Опустошённый legacy-документ никогда не становится каноническим снова
const drainedLegacy = { id: 'email:case16@mail.ru', data: { keys: 0, mergedInto: 'tg_case16', dataMigratedInto: 'tg_case16', identityStatus: 'legacy_linked' } };
assert.equal(selectCanonicalUserForTest([drainedLegacy, tgAlreadyCanonical]).id, 'tg_case16');

// 6. Админский документ побеждает документ с данными (активный админ-доступ)
const adminDoc = { id: 'admin-uid', data: { role: 'super_admin', adminStatus: 'active', firebaseUid: 'admin-uid' } };
assert.equal(selectCanonicalUserForTest([emailDocWithData, adminDoc]).id, 'admin-uid');

// 7. Профильные сценарии: любой набор способов входа → один Canonical User
const scenarios = [
  { name: 'только Email', candidates: [emailDocWithData], expect: 'email:case16@mail.ru' },
  { name: 'только Telegram', candidates: [emptyTgDoc], expect: 'tg_case16' },
  { name: 'Email + Telegram', candidates: [emailDocWithData, emptyTgDoc], expect: 'email:case16@mail.ru' },
  {
    name: 'Email + VK',
    candidates: [
      { id: '99887766', data: { authProvider: 'vk', keys: 30, favorites: ['p1', 'p2'], completedTasks: ['first_open'] } },
      { id: 'email:vkuser@mail.ru', data: { email: 'vkuser@mail.ru', keys: 1 } },
    ],
    expect: '99887766',
  },
];
scenarios.forEach(({ name, candidates, expect }) => {
  assert.equal(selectCanonicalUserForTest(candidates).id, expect, `сценарий «${name}»`);
  assert.equal(selectCanonicalUserForTest([...candidates].reverse()).id, expect, `сценарий «${name}» не зависит от порядка кандидатов`);
});

// 8. Partner + Expert: роли и кабинеты объединяются, ни один не скрывает другой
const partnerExpertPatch = buildCanonicalPatch({
  canonicalId: 'tg_pro',
  candidates: [
    { id: 'tg_pro', data: { keys: 12, partnerId: 'partner-1', partnerCabinetIds: ['partner-1'] } },
    { id: 'email:pro@mail.ru', data: { email: 'pro@mail.ru', expertId: 'expert-1', expertCabinetIds: ['expert-1'] } },
  ],
  email: 'pro@mail.ru',
  provider: 'email',
  firebaseUid: '',
});
assert.ok(partnerExpertPatch.roles.includes('partner') && partnerExpertPatch.roles.includes('expert'), 'роли partner и expert одновременно');
assert.deepEqual(partnerExpertPatch.partnerCabinetIds, ['partner-1']);
assert.deepEqual(partnerExpertPatch.expertCabinetIds, ['expert-1']);
assert.equal(partnerExpertPatch.canonicalUserId, 'tg_pro', 'canonical не подменяется — новый профиль не создаётся');

// 9. Роли не понижаются при слиянии
const rolesPatch = buildCanonicalPatch({
  canonicalId: 'tg_case16',
  candidates: [tgAlreadyCanonical, { ...emailDocWithData, data: { ...emailDocWithData.data, role: 'expert' } }],
  email: 'case16@mail.ru',
  provider: 'email',
  firebaseUid: '',
});
assert.ok(rolesPatch.roles.includes('expert'), 'роль из legacy-документа сохраняется');

// 10. dataRichness: статистика учитывает все носители данных
assert.ok(dataRichness(emailDocWithData.data) > dataRichness(emptyTgDoc.data), 'богатство данных различимо');

console.log('Identity Core regression tests passed (включая постоянный кейс «16 → 9»)');
