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
        Conversation Engine v1
        ├── Conversation Session
        ├── Conversation Context
        ├── Conversation Resolver
        ├── Conversation References
        ├── Conversation Topics
        ├── Conversation History
        ├── Conversation Snapshot
        └── Conversation Validator
                    │
        Capability Engine v1
        ├── Capability Engine
        ├── Capability Resolver
        ├── Capability Registry
        ├── Capability Matcher
        ├── Capability Context
        ├── Capability History
        ├── Capability Snapshot
        ├── Capability Explanation
        └── Capability Validator
                    │
           Journey Engine v1
        ├── Goal Detector
        ├── Journey Planner
        ├── Journey State
        ├── Progress Tracker
        └── Action Resolver
                    │
        Personalization Engine v1
        ├── User Context Builder
        ├── User Profile Analyzer
        ├── Preference Resolver
        ├── Recommendation Adjuster
        └── Explanation Builder
                    │
        Memory Engine v1
        ├── Memory Store
        ├── Memory Collector
        ├── Memory Resolver
        ├── Memory Ranker
        ├── Memory Validator
        ├── Memory History
        └── Memory Snapshot
                    │
        Proactive Assistant v1
        ├── Opportunity Detector
        ├── Priority Resolver
        ├── Timing Resolver
        ├── Dismiss Manager
        ├── Opportunity History
        └── Proactive Card Builder
                    │
        Observability & Quality Center v1
        ├── Conversation Analytics
        ├── Intent Analytics
        ├── Fallback Analytics
        ├── Journey Analytics
        ├── Recommendation Analytics
        ├── Proactive Analytics
        ├── Quality Score
        └── Insight Generator
                    │
        Planner v1
        ├── Intent Classifier
        ├── Goal Resolver
        ├── Plan Builder
        ├── Step Executor
        ├── Plan Validator
        └── Plan History
                    │
        Workflow Engine v1
        ├── Workflow Registry
        ├── Workflow Resolver
        ├── Workflow Planner
        ├── Workflow Runner
        ├── Workflow Progress
        ├── Workflow State
        ├── Workflow Validator
        ├── Workflow History
        └── Workflow Snapshot
                    │
        Agent Mode v1
        ├── Agent Engine
        ├── Agent Resolver
        ├── Agent Context
        ├── Agent Decision
        ├── Agent Executor
        ├── Agent Session
        ├── Agent Continuation
        ├── Agent Confirmation
        ├── Agent Safety
        ├── Agent History
        └── Agent Snapshot
                    │
        Tool Calling v1
        ├── Tool Registry
        ├── Tool Resolver
        ├── Tool Validator
        ├── Tool Executor
        ├── Tool Result
        ├── Tool History
        └── Read-only domain tools
                    │
        Action Center v1
        ├── Action Registry
        ├── Action Resolver
        ├── Action Validator
        ├── Action Executor
        └── Action History
                    │
        Decision Intelligence v1
        ├── Decision Engine
        ├── Decision Trace
        ├── Decision Resolver
        ├── Decision Scorer
        ├── Decision Explanation
        ├── Decision History
        ├── Decision Snapshot
        └── Decision Validator
                    │
        Quality & Evaluation Framework v1
        ├── Evaluation Engine
        ├── Evaluation Context
        ├── Evaluation Metrics
        ├── Evaluation Scorer
        ├── Evaluation History
        ├── Evaluation Snapshot
        ├── Evaluation Explanation
        └── Evaluation Validator
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
| Capability Engine | V1 production | read-only слой после Reasoning/Conversation resolution: определяет функцию приложения (`BOOK_APPOINTMENT`, `OPEN_REWARDS`, `SEARCH_PROMOTIONS` и др.), параметры, missing values, alternatives и execution order без изменения ответов или downstream-движков |
| Conversation Engine | V1 production | локальный слой после Reasoning: удерживает темы диалога, активные сущности, местоимения, порядковые ссылки и follow-up context перед Journey/Planner/Agent без Firestore/API |
| Journey Engine | V1 production | read-only слой после Conversation: определяет цель пользователя, строит локальный путь, отслеживает прогресс и предлагает следующий action без backend/Firestore |
| Personalization Engine | V1 production | read-only слой после Journey: строит пользовательский контекст из уже загруженного app state, динамически вычисляет предпочтения, адаптирует рекомендации и объясняет используемые данные |
| Memory Engine | V1 production | локальный read-only/append-only слой пользовательской памяти: собирает обезличенные предпочтения, активность, conversation-сигналы и successful recommendations; отдаёт Planner готовый Memory Snapshot |
| Proactive Assistant | V1 production | read-only/local слой поверх загруженного app state: находит одну полезную opportunity, уважает timing, dismiss, cooldown, silent mode и объясняет причину показа |
| Observability & Quality Center | V1 production | read-only analytics слой поверх существующих Loki events: KPI, intent/fallback/journey/proactive analytics, quality score, insights, session inspector и CSV export |
| Planner | V1 production | read-only слой перед Tool Calling: классифицирует многошаговые запросы, строит прозрачный план, выполняет шаги только через существующий Tool Executor и хранит локальную Plan History |
| Workflow Engine | V1 production | декларативный слой после Planner: выбирает сценарий, строит последовательность шагов, выполняет только существующие read-only tools, ждёт пользовательские действия и хранит локальные Workflow Snapshot/History |
| Agent Mode | V1 production | тонкий orchestration layer поверх Planner/Workflow/Tool/Action: выбирает RESPOND/RUN_TOOL/START_WORKFLOW/CONTINUE_WORKFLOW/ASK_CONFIRMATION/WAIT_USER/FINISH, хранит локальную Agent Session и требует подтверждение перед потенциально изменяющими действиями |
| Tool Calling | V1 production | read-only internal tool layer поверх Knowledge snapshot: user/promotions/events/meetings/gifts/news/workspace/search tools, TTL cache, local Tool History и observability events без LLM tool calling |
| Action Center | V1 production | client-only слой поверх существующих действий приложения: registry, resolver, validator, executor, local history и action-кнопки в ответах Локи без новых API/Firestore |
| Decision Intelligence | V1 production | read-only слой после Action Center: фиксирует итоговое решение ответа, confidence, trace участвующих движков, альтернативы, причину выбора, локальный snapshot/history и explain mode без изменения pipeline-логики |
| Quality & Evaluation Framework | V1 production | read-only слой после Decision Intelligence: детерминированно оценивает уже сформированный ответ по answer/context/tool/decision/action/personalization/conversation/hallucination/confidence, хранит локальный snapshot/history и показывает dev-блок Evaluation |
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
- Action Center использует только существующие `LOKI_APP_ACTIONS` и browser-safe действия; новые backend/API действия не добавляются.
- Перед выполнением Action Center проверяет наличие объекта, публикацию/архив, доступность route handler и права actor.
- Tool Calling v1 использует только уже загруженный `KnowledgeProvider` snapshot; tools не импортируют Firebase, не вызывают `fetch`, не создают API/backend действия и не меняют данные.
- Tool Validator проверяет наличие tool, read-only контракт, роль пользователя и готовность контекста; denied/failed превращаются в безопасный Loki-ответ или совместимый fallback.
- Capability Engine v1 не исполняет действия и не выбирает данные за пользователя: слой только читает question/intent/reasoning/conversation/context/memory/knowledge, добавляет `capabilityContext`/`capabilitySnapshot` и локальную `capabilityHistory` на 100 записей.
- Capability Registry описывает возможности приложения декларативно: id, title, description, aliases, required/optional parameters, role, tools, screens, priority и category; Firestore, API, backend, Planner, Workflow, Agent, Tool Calling, Action Center, Decision и Evaluation не меняются.
- Decision Intelligence v1 не выбирает новые данные и не исполняет действия: слой только анализирует уже готовый ответ после Knowledge/Reasoning/Conversation/Journey/Memory/Planner/Workflow/Agent/Tool/Action Center и сохраняет локальный `decisionContext`.
- Decision History хранится только локально в Loki memory как `lastDecisionContext`/`decisionSnapshot`/`decisionHistory`; Firestore, backend, API, Security Rules и business logic не меняются.
- Explain Mode для вопроса “Почему ты это предложил?” использует последний локальный decision snapshot и не вызывает новые tools, backend или Firestore.
- Quality & Evaluation Framework v1 не вызывает LLM, tools, backend, API или Firestore: слой только читает уже готовые `result/context/trace`, добавляет `evaluationContext`, `evaluationMetrics`, `evaluationSnapshot` и локальную `evaluationHistory` на 100 записей.
- Evaluation не меняет `text`, `cards`, `actions`, business logic или Decision outcome; UI-блок `Evaluation` отображает только локальные диагностические поля.
- Planner v1 не вызывает backend, Firestore или API напрямую; он строит план, валидирует tool-шаги и исполняет только read-only tools из `ToolRegistry`.
- План сохраняется только локально в Loki memory как `lastPlanContext`/`planHistory`, чтобы debug и follow-up могли видеть цель, шаги, failed/completed и duration без серверной памяти.
- Workflow Engine v1 не содержит бизнес-логики и не создаёт новые действия: workflow-декларации описывают шаги, tool-шаги идут через существующий `ToolExecutor`, а шаги действий останавливают сценарий в `WAITING_USER`.
- Workflow Snapshot передаётся Planner как готовый локальный снимок, чтобы Planner не обращался к Runner и не повторял уже завершённые шаги активного сценария.
- Workflow History хранится только локально в Loki memory как `lastWorkflowContext`/`workflowHistory`, без Firestore, backend, API и изменений схемы.
- Agent Mode v1 не является новым мозгом Локи: он не содержит сценарных деклараций, не импортирует Workflow declarations и работает только с абстракциями `Decision`, `Session`, `Continuation`, `Confirmation`, `Safety`.
- Agent Session хранится локально как `lastAgentSession`/`agentHistory`; Firestore, backend, API, Security Rules и business logic не меняются.
- Agent Safety валидирует только реальные `LOKI_APP_ACTIONS` через существующий Action Validator и запрашивает подтверждение перед потенциально state-changing действиями: запись, регистрация, отправка, отмена, подтверждение, изменение данных.
- При коротком ответе пользователя `да`/`отмена` Agent Continuation использует активную локальную session и не запускает Planner повторно.
- Conversation Engine v1 хранит только локальную `lastConversationSession`/`conversationHistory`, не импортирует Firebase/API, не выполняет запросы и отдаёт Planner/Workflow/Agent готовый `conversationSnapshot`.
- Conversation Validator не угадывает неоднозначные местоимения: если ссылка может относиться к нескольким объектам разных типов, Локи просит уточнение.
- Memory Engine v1 хранит данные только локально в `userMemory.lokiMemory`, не отправляет их во внешние сервисы, не импортирует Firebase/API и фильтрует email, телефоны, пароли, токены, платёжные и другие чувствительные данные.
- Planner получает только готовый `memorySnapshot`; прямого доступа Planner к Memory Store нет.
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
npm run test:loki-planner
npm run test:loki-memory
npm run test:loki-workflow
npm run test:loki-agent
npm run test:loki-conversation
npm run test:loki-personalization
npm run test:loki-proactive
npm run test:loki-observability
npm run test:loki-actions
npm run test:loki-tool
npm run build
```

Тесты покрывают schema/duplicate guard, plugin resolution, permission denial, safe client action, memory compaction, analytics privacy buckets, voice configuration, event planner, 100 knowledge-вопросов по данным АПГ, 200 reasoning-сценариев, 250 journey-сценариев, 914 planner-сценариев, 1000+ memory-сценариев, 1200+ workflow-сценариев, 1500+ agent-сценариев, 1800+ conversation-сценариев, 300 personalization-сценариев, 400 proactive-сценариев, 500 observability-сценариев, 618 action-сценариев и 844 tool-сценария: registry, resolver, validator, executor, TTL cache, local Tool/Plan/Workflow/Agent/Conversation History, Action Center integration, denied/empty states, прозрачные `planContext`/`workflowContext`/`agentContext`/`conversationContext`, Memory/Workflow/Agent/Conversation Snapshot, privacy guard и отсутствие Firestore/API/fetch imports в Tool/Planner/Memory/Workflow/Agent/Conversation Layer.

## Следующие production-этапы

1. Подключить постоянный Admin Assistant UI к данным конкретной вкладки.
2. Добавить role-aware контекст Partner/Expert cabinets.
3. Создать защищённый backend endpoint для Loki actions и analytics с audit log.
4. Перенести личную память в opt-in server storage с удалением и экспортом.
5. Наполнять 207 сценариев партиями только вместе с тестовыми наборами и владельцами данных.
