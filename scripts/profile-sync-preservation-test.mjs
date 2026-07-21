import assert from 'node:assert/strict';
import { buildSafeProfileSyncPatch } from '../server/src/routes/user-actions.js';

const current = {
  id: 'email:gordeeva.tatyana@mail.ru',
  email: 'gordeeva.tatyana@mail.ru',
  emailVerified: true,
  displayName: 'Татьяна Гордеева',
  firstName: 'Татьяна',
  lastName: 'Гордеева',
  photo: 'https://photos.example/tatyana.jpg',
  keys: 5,
  reputation: 17,
  completedTasks: ['first_open', 'news_read'],
  roles: ['super_admin', 'user', 'partner'],
  friends: ['friend-a'],
  linkedTelegram: { tgId: 'tg_875814883' },
  partnerId: 'demo-partner-apg',
};

const defaultEmailPayload = {
  email: 'gordeeva.tatyana@mail.ru',
  emailVerified: false,
  displayName: 'gordeeva.tatyana',
  firstName: 'gordeeva.tatyana',
  lastName: null,
  photo: null,
  keys: 0,
  reputation: 0,
  completedTasks: [],
  roles: [],
  friends: [],
  linkedTelegram: null,
  partnerId: null,
};

assert.deepEqual(
  buildSafeProfileSyncPatch(current, defaultEmailPayload, { userId: current.id }),
  { email: 'gordeeva.tatyana@mail.ru' },
  'profile:sync must not degrade a rich canonical profile with default email payload',
);

assert.deepEqual(
  buildSafeProfileSyncPatch({ email: current.email }, {
    displayName: 'Татьяна Гордеева',
    firstName: 'Татьяна',
    lastName: 'Гордеева',
    photo: 'https://photos.example/tatyana.jpg',
    emailVerified: true,
  }, { userId: current.id }),
  {
    displayName: 'Татьяна Гордеева',
    firstName: 'Татьяна',
    lastName: 'Гордеева',
    photo: 'https://photos.example/tatyana.jpg',
    emailVerified: true,
  },
  'profile:sync must accept richer profile values',
);

console.log('Profile sync preservation regression test passed');
