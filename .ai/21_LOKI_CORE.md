# 21 LOKI CORE

Loki Core is the modular orchestration layer for Loki. UI components do not call domain modules directly. They call `askLokiBrain()`, which delegates to `LokiCore`.

## Flow

```text
User request
  ↓
LokiBrain facade
  ↓
Loki Core
  ↓
Memory Engine enriches context
  ↓
APG Knowledge Base adds world knowledge
  ↓
Brain Layer detects scenario, context and best action
  ↓
Capability modules are checked in order
  ↓
Selected module returns a grounded result
  ↓
Personality Engine shapes tone/emotion
  ↓
Loki Experience / Loki Assistant renders response
  ↓
Loki Actions execute navigation or app action
```

## Modules

| Module | Responsibility |
|---|---|
| `Navigator` | Navigation intents, follow-up actions, scanner, profile, nearby, notifications |
| `KnowledgeExpert` | Screens, features and release history from Хроники АПГ |
| `PartnerExpert` | Partners, categories, cafes, food, massage, offers, places |
| `EventExpert` | Events, city agenda, upcoming activities |
| `RewardsExpert` | Keys, achievements, tasks, prizes, raffles |
| `NewsExpert` | News-only answers |
| `ProfileExpert` | User profile, account, favorites, settings |
| `RecommendationEngine` | Personal recommendations based on already loaded data |
| `MemoryEngine` | Conversation/user context enrichment only |
| `BrainLayer` | AI Platform layer: scenario detection, context-aware recommendation, action planning |
| `ObserverModule` | Documents the proactive observer layer; runtime observer remains `LokiObserver.js` |
| `PersonalityEngine` | Tone, brevity, emotion, final response shape |

## Brain Layer

`src/loki/core/brain/BrainLayer.js` is the primary decision layer for Loki.

It runs before the legacy capability modules and turns Loki from a chat-style assistant into an APG decision platform:

- detects user intent through scenario matching instead of a single keyword branch;
- uses 50+ scenarios from `src/loki/core/brain/lokiScenarios.js`;
- combines runtime context: time of day, day of week, current screen, dialog history, interests and local memory;
- chooses the best partner, event, expert or news item instead of returning a plain list;
- explains why the choice is best;
- returns app actions through `LOKI_APP_ACTIONS`.

Every Brain Layer response follows this structure:

```text
Понял задачу
Анализ
Лучшее решение
Почему
Дальше
```

The legacy modules remain as fallback for narrow commands and old scenarios.

## Extension Contract

A new capability module is registered in `src/loki/core/LokiCore.js`.

```js
export const NewModule = {
  id: 'newModule',
  label: 'New Module',
  canHandle({ query, context, text }) {
    return true;
  },
  handle({ query, context, text }) {
    return {
      intent: 'new.intent',
      text: 'Short grounded answer.',
      card: null,
      cards: [],
    };
  },
};
```

Modules must not touch React, Router, Firestore, or UI state directly. They return actions through `createLokiAction()`.

## AI Providers

`src/loki/core/lokiAiProviders.js` defines provider ids:

- `localRules` — current deterministic local implementation.
- `cloudLlm` — future backend LLM.
- `specializedModel` — future narrow models.

Switching providers must not change domain module interfaces.

## Debug Mode

Enable developer trace in the browser console:

```js
localStorage.setItem('apg_loki_debug', '1')
```

Disable:

```js
localStorage.removeItem('apg_loki_debug')
```

When enabled, `Loki Experience` shows:

- selected provider;
- total orchestration time;
- modules checked;
- module decisions;
- module timings.
