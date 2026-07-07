# 22 APG KNOWLEDGE

The APG Knowledge System is called **Хроники АПГ**. It is not developer documentation. It is Loki's structured world memory.

## Layers

```text
APG Knowledge Base
  Global world knowledge: screens, features, releases, rules.

Loki User Memory
  Useful personal signals only: favorite categories, frequent intents, recent queries.

Loki Brain
  Loki Core combines Knowledge Base + User Memory + current app data.

Loki Proactive Intelligence
  Loki observes app context, learns from accepted/ignored advice, plans routes,
  and shows useful recommendations only when the priority/quiet rules allow it.
```

## Files

```text
src/loki/knowledge/
  world/about.json
  screens/screens.json
  features/features.json
  updates/chronicles.json
  index.js

src/loki/core/lokiUserMemory.js
src/loki/LokiIntelligence.js
src/loki/LokiLearning.js
src/loki/LokiPlanner.js
scripts/update-apg-chronicles.mjs
```

## Update Flow

After updating `.ai/17_CHANGELOG_AI.md`, run:

```bash
npm run knowledge:update
```

This regenerates `src/loki/knowledge/updates/chronicles.json` from the AI changelog. The generated entries let Loki answer questions like:

- Что нового появилось?
- Когда появилась функция?
- Как развивался Локи?

## Integrity

`validateApgKnowledgeBase()` checks the minimum required structure:

- world info exists;
- screens are present;
- features are present;
- chronicles array exists.

## User Memory

`lokiUserMemory` stores only useful product signals:

- favorite categories;
- frequent intents;
- last few queries.

It does not store sensitive personal details. The UI can clear this memory through `loki.resetUserMemory()`.

## Proactive Intelligence

`LokiIntelligence` analyzes the current app state and returns only real APG-backed recommendations. It must not invent partners, events, news, offers, prizes, or routes.

`LokiLearning` stores lightweight local signals:

- screen visits;
- accepted recommendations;
- ignored recommendations;
- category affinity.

`LokiPlanner` builds user-facing plans:

- personal route for “Что мне сегодня посмотреть?”;
- discovery answer for “Удиви меня”.

All recommendations must pass `lokiPriority` quiet rules before they reach the UI.

## Voice Mode

`LokiExperience` uses browser APIs:

- `SpeechRecognition` / `webkitSpeechRecognition` for speech-to-text;
- `speechSynthesis` for voice answer.

If unsupported, Loki falls back to text mode.
