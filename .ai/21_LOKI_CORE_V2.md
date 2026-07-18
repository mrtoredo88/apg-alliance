# Loki Core V2

## Статус

Loki Core V2 внедрён как совместимый архитектурный слой над существующим Loki. В production-коде остаются 63 активных пользовательских сценария. V2 добавляет строгие контракты, позволяющие расширить каталог до 250–300 сценариев без изменения ядра.

## Схема

```text
Клиент АПГ / кабинет / админка / внешний канал
                    │
             Context Engine
                    │
       Knowledge Provider + Intent Router
                    │
          Reasoning Engine v1
        ├── Ranking Engine
        ├── Context Resolver
        ├── Confidence Calculator
        ├── Suggestion Engine
        └── Answer Composer
                    │
           Journey Engine v1
        ├── Goal Detector
        ├── Journey Planner
        ├── Journey State
        ├── Progress Tracker
        └── Action Resolver
                    │
        Scenario Registry + Intent/Brain
                    │
       Module Registry (role-aware plugins)
        ├── Planner Engine
        ├── Reasoner
        ├── Recommendation Engine
        ├── Admin Assistant
        ├── Personality + Humor
        ├── Memory Policy
        ├── Voice Engine
        └── Analytics Engine
                    │
        Permission Engine + Action Engine
          ├── безопасная навигация клиента
          └── привилегированные действия только backend
```

Ядро не содержит жёстко зашитых продуктовых знаний АПГ: статическая база остаётся в `src/loki/knowledge`, а runtime-данные приложения собираются совместимым слоем `src/loki/core/knowledge`. Сценарии остаются в каталоге сценариев, интеграции — в модулях и action adapters. Поэтому те же контракты можно использовать в web, VK, Telegram, desktop или другом продукте.

## Контракт сценария

Обязательные нормализованные поля: `id`, `title`, `role`, `category`, `priority`, `intent`, `triggerConditions`, `requiredData`, `requiredPermissions`, `quickReplies`, `followUpActions`, `fallback`, `relatedScenarios`, `handler`, `enabled`.

`ScenarioRegistry` отклоняет некорректные и повторяющиеся id. Новый сценарий регистрируется данными и обработчиком без изменения ядра.

## Карта 270 сценариев

| Домен | Цель | Активно сейчас | Следующий каталог |
|---|---:|---:|---:|
| Пользователь | 80 | 63 пользовательских сценария в общем каталоге | 17 |
| Партнёр | 40 | кабинетные подсказки вне V2 registry | 40 |
| Эксперт | 30 | кабинетные подсказки вне V2 registry | 30 |
| Администратор | 30 | универсальный admin diagnostics module | 30 |
| Автоматизация | 20 | существующий backend Automation Engine | 20 |
| Новости | 20 | входят в пользовательские сценарии | 20 |
| Мероприятия | 20 | входят в пользовательские сценарии | 20 |
| Игровые механики | 15 | входят в пользовательские сценарии | 15 |
| Контекстные | 15 | news context + Context Engine | 15 |
| **Всего целевой каталог** | **270** | **63 формализованных** | **207 к наполнению** |

Числа в последнем столбце — продуктовая карта наполнения, а не заявление о реализованных сценариях. Создание 207 содержательных сценариев требует отдельных acceptance criteria, владельцев данных и разрешённых backend-действий.

## Статус движков

| Движок | Статус | Ограничение |
|---|---|---|
| Brain / Intent | production, совместимый | эвристический semantic scoring, без внешней LLM по умолчанию |
| Knowledge Provider | V1 production | агрегирует существующие partners/experts/locations/promotions/events/gifts/news/reviews/bookings/dialogs/workspace data без новых коллекций |
| Intent Router | V1 production | определяет search/info/profile/workspace/card intents перед legacy-модулями |
| Reasoning Engine | V1 production | read-only слой после Knowledge Provider: ранжирует варианты, считает confidence, хранит follow-up контекст локально и предлагает действия без новых API |
| Journey Engine | V1 production | read-only слой после Reasoning: определяет цель пользователя, строит локальный путь, отслеживает прогресс и предлагает следующий action без backend/Firestore |
| Context | production | news context сохранён; runtime context теперь дополняется Knowledge Provider |
| Scenario Registry | V2 готов | 63 legacy-сценария нормализуются при загрузке |
| Module Registry | V2 готов | role-aware, приоритетный, без switch/case |
| Reasoner | V2 готов | объединяет partners/experts/events/news по доступным данным |
| Planner | V2 готов | план события; действия только после подтверждения |
| Permission / Action | V2 готов | привилегированные действия запрещены без backend executor |
| Memory | V2 policy готов | локальная legacy-память ещё не синхронизируется между устройствами |
| Recommendation | production, совместимый | использует доступные данные приложения |
| Admin Assistant | V2 engine готов | постоянный UI админ-помощника ещё не подключён |
| Humor | V2 готов | три профиля; подавление в critical-контексте |
| Personality | production, совместимый | выбор характера ещё не вынесен в настройки UI |
| Voice | V2 controller готов | browser Speech Synthesis; распознавание остаётся legacy UI |
| Analytics | V2 schema готов | transport в backend намеренно не включён без отдельного endpoint |
| Automation | backend production foundation | Loki только формирует план, публикация не автоматическая |

## Безопасность

- Роль и permissions проверяются до выполнения действия.
- Навигационные client actions отделены от privileged backend actions.
- Создание и публикация не маскируются под клиентские вызовы.
- Planner по умолчанию создаёт подтверждаемый план, а не выполняет изменения.
- Memory policy удаляет поля с email, phone, token, password и address, ограничивает размер и TTL.
- Analytics event не хранит сырой текст запроса.

## Проверки

```bash
npm run test:loki
npm run test:loki-knowledge
npm run test:loki-reasoning
npm run test:loki-journey
npm run build
```

Тесты покрывают schema/duplicate guard, plugin resolution, permission denial, safe client action, memory compaction, analytics privacy buckets, voice configuration, event planner, 100 knowledge-вопросов по данным АПГ, 200 reasoning-сценариев и 250 journey-сценариев: goal detection, planning, progress, recovery, completion, summary, suggestions и action resolution.

## Следующие production-этапы

1. Подключить постоянный Admin Assistant UI к данным конкретной вкладки.
2. Добавить role-aware контекст Partner/Expert cabinets.
3. Создать защищённый backend endpoint для Loki actions и analytics с audit log.
4. Перенести личную память в opt-in server storage с удалением и экспортом.
5. Наполнять 207 сценариев партиями только вместе с тестовыми наборами и владельцами данных.
