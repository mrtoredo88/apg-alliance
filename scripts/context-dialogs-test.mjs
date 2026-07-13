import assert from 'node:assert/strict';
import {
  CONTEXT_DIALOG_TYPES,
  buildContextDialogId,
  buildDialogAutoAnswer,
  buildDialogContext,
  normalizeDialogType,
} from '../server-shared/context-dialogs.js';

assert.ok(CONTEXT_DIALOG_TYPES.partner);
assert.ok(CONTEXT_DIALOG_TYPES.expert);
assert.ok(CONTEXT_DIALOG_TYPES.event);
assert.ok(CONTEXT_DIALOG_TYPES.promotion);

assert.equal(normalizeDialogType('PARTNER'), 'partner');
assert.equal(normalizeDialogType('unknown'), '');

const id = buildContextDialogId('user/1', 'partner', 'coffee house');
assert.equal(id, 'user_1__partner__coffee_house');
assert.equal(buildContextDialogId('user/1', 'bad', 'x'), '');

const partnerContext = buildDialogContext('partner', {
  id: 'p1',
  name: 'Coffee Time',
  categoryLabel: 'Кофейня',
  hours: '09:00-22:00',
  address: 'Зеленоград',
  ownerUserIds: ['owner1', 'owner1'],
});
assert.equal(partnerContext.type, 'partner');
assert.equal(partnerContext.objectId, 'p1');
assert.equal(partnerContext.partnerId, 'p1');
assert.deepEqual(partnerContext.ownerUserIds, ['owner1']);

const promoContext = buildDialogContext('promotion', {
  id: 'p1',
  name: 'Coffee Time',
  offer: 'Кофе + десерт',
});
assert.equal(promoContext.type, 'promotion');
assert.equal(promoContext.title, 'Кофе + десерт');
assert.equal(promoContext.partnerId, 'p1');
assert.equal(promoContext.promotionId, 'p1');

assert.equal(buildDialogAutoAnswer(partnerContext, 'До скольки работаете?'), 'По данным карточки: 09:00-22:00.');
assert.equal(buildDialogAutoAnswer(partnerContext, 'Как добраться?'), 'Адрес из карточки: Зеленоград.');
assert.equal(buildDialogAutoAnswer(partnerContext, 'Можно с ребенком?'), null);

console.log('context-dialogs-test passed');
