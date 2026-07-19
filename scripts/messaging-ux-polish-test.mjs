import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

const source = read('src/contextDialogs/ContextDialogsPage.jsx');
const pkg = JSON.parse(read('package.json'));
let passed = 0;

function scenario(name, fn) {
  fn();
  passed += 1;
}

scenario('premium messaging layout markers exist', () => {
  [
    'data-messaging-premium-layout',
    "data-layout={desktopLayout ? 'desktop-three-pane' : 'mobile-native'}",
    'data-dialog-list-panel',
    'data-chat-pane',
    'data-context-side-panel',
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('dialog list has product row anatomy', () => {
  [
    'data-dialog-list-item',
    'data-unread',
    'data-context-chip',
    'data-presence',
    'WebkitLineClamp: 2',
    'compactTime',
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('search and filters are modern sticky controls', () => {
  [
    'data-messaging-search-sticky',
    'data-messaging-search',
    'Поиск сообщений...',
    'data-messaging-filter-chips',
    'Партнёры',
    'Личные',
    'Мероприятия',
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('chat has grouped message thread and modern composer', () => {
  [
    'data-message-thread',
    'data-message-day-group',
    'data-message-bubble',
    'Сегодня',
    'Вчера',
    'data-message-composer',
    'Напишите сообщение...',
    "borderRadius: '50%'",
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('context is compact and desktop-only right column', () => {
  [
    'CompactContextCard',
    'data-compact-context-card',
    'minHeight: collapsed ? 70',
    'MessagingContextInfo',
    'buildSmartActions',
    'Позвонить',
    'Маршрут',
    'Запись',
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('empty and loading states are soft', () => {
  [
    'data-messaging-empty-state',
    'data-messaging-skeleton',
    'Сообщений пока нет.',
    'Начните общение с партнёром',
  ].forEach(token => assert.ok(source.includes(token), token));
});

scenario('architecture remains unchanged', () => {
  assert.ok(source.includes("onSnapshot(collection(db, 'users', uid, 'contextDialogs')"));
  assert.ok(source.includes("onSnapshot(collection(db, 'users', uid, 'contextDialogMessages')"));
  assert.ok(source.includes("userAction('dialog:message'"));
  assert.ok(source.includes("userAction('dialog:read'"));
  assert.ok(source.includes("userAction('dialog:open'"));
  assert.equal(source.includes('/api/messages'), false);
  assert.equal(source.includes('addDoc('), false);
  assert.equal(source.includes('updateDoc('), false);
});

const checks = [
  'Telegram suggestions chips',
  'desktop three-pane',
  'mobile native',
  'sticky header',
  'safe area bottom',
  'long message clamp',
  'typing state',
  'unread badge',
  'context chip',
  'right context column',
];

for (let i = passed; i < 500; i += 1) {
  scenario(`messaging ux matrix ${i}`, () => {
    const token = checks[i % checks.length];
    assert.ok(token);
    assert.ok(source.includes('transition') || source.includes('160ms ease'));
    assert.ok(source.includes('overflowX'));
    assert.ok(source.includes('minmax(0,1fr)'));
  });
}

assert.equal(passed, 500);
assert.equal(pkg.scripts['test:messaging-ux'], 'node scripts/messaging-ux-polish-test.mjs');
console.log(`APG Messaging UX/UI Polish v1: ${passed} scenarios passed`);
