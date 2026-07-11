# Identity Core

Identity Core — единое ядро идентификации АПГ. Его задача: после любого способа входа определить одного канонического пользователя и передавать в приложение именно его роли, кабинеты и профильные данные.

## Главный принцип

Один человек = один Canonical User.

VK ID, email, Telegram, Firebase UID и будущие Apple/Google-аккаунты — это не отдельные пользователи, а связанные идентичности одного canonical user.

## Источник истины

На этапе V1 источником истины остаётся `users/{canonicalUserId}`, чтобы не ломать существующую архитектуру, кабинеты, ключи и активность.

Дополнительно создаётся слой связей:

- `canonicalUsers/{canonicalUserId}` — сводка canonical user;
- `identityLinks/{type:value}` — связь конкретной идентичности с canonical user;
- `emailIndex/{email}` — теперь указывает на `canonicalUserId`;
- `auth_map/{firebaseUid}` — теперь хранит `canonicalUserId`;
- legacy `users/email:...`, `users/tg_...`, `users/{vkId}` не удаляются, а получают `canonicalUserId` и `identityStatus: legacy_linked`.

## Identity Resolver

Resolver находится в `server/src/lib/identityCore.js`.

Для email он проверяет:

1. `emailIndex`;
2. `users/email:{email}`;
3. `users where email == email`;
4. `users where linkedEmail == email`;
5. `users where linkedEmails array-contains email`.

Если найдено несколько документов, canonical выбирается по приоритету:

1. активные административные роли;
2. `owner`;
3. `super_admin`;
4. `admin`;
5. существующий canonical-документ;
6. документ с Firebase UID;
7. обычные роли.

Это исправляет конфликт, когда один email одновременно был у owner-документа и legacy `email:...` partner-документа.

## Role Engine

Роли хранятся у canonical user:

- `role` — главная роль;
- `userRole` — совместимость с текущей админкой;
- `roles[]` — полный набор ролей.

Workspace и кабинеты должны использовать `roles[]`, а не VK ID или случайный email-документ.

## Cabinet Engine

Кабинеты принадлежат canonical user:

- `partnerId`;
- `partnerCabinetIds[]`;
- `expertId`;
- `expertCabinetIds[]`;
- `partnerCabinetEnabled`;
- `expertCabinetEnabled`.

Legacy-документы могут сохранять старые поля, но новые проверки должны идти через canonical user.

## Мягкая миграция

V1 не удаляет документы и не переносит историю физически.

При логине или диагностике Identity Core:

1. находит все связанные документы;
2. выбирает canonical user;
3. обновляет `emailIndex`;
4. создаёт/обновляет `identityLinks`;
5. создаёт/обновляет `canonicalUsers`;
6. помечает legacy-документы ссылкой `canonicalUserId`.

Так роли, кабинеты, ключи, история, комментарии и будущие платежи не теряются.

## Workspace

Workspace теперь должен открываться только по canonical roles.

VK-профиль `users/988504` не является автоматическим owner-доступом. Если этот профиль не имеет роли, он остаётся пользовательским мобильным режимом.

Owner Workspace открывается через canonical owner-документ и `roles: ['owner']`.

## Диагностика

В профиле доступна `Диагностика Identity`.

Она показывает:

- canonical user;
- открытый профиль;
- роли;
- partner/expert cabinets;
- найденные документы;
- почему выбран именно этот canonical user.

Backend action: `POST /api/user-actions` с `action: identity:diagnostics`.

## Точки подключения

- `server/src/routes/email-auth.js` — email login/verify возвращает canonical user;
- `server/src/routes/admin-login.js` — admin login ищет администратора через Identity Core;
- `server/src/routes/user-actions.js` — actor resolver использует Identity Core;
- `server/src/lib/adminSecurity.js` — admin permissions используют canonical user;
- `src/UserApp.jsx` — после старта уточняет canonical user и обновляет локальную сессию;
- `src/workspace/WorkspaceFeatureFlags.js` — Workspace больше не использует hardcoded VK ID.

## Будущие способы входа

Apple, Google и другие провайдеры должны добавляться как новый identity link:

```js
identityLinks/{provider}:{providerUserId} -> canonicalUserId
```

Остальная архитектура должна продолжать работать через canonical user.
