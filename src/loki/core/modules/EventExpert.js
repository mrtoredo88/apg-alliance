import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { includesAny, makeResultCard, titleOf, toMillis } from '../lokiCoreUtils.js';

function upcomingEvents(events = []) {
  const now = Date.now();
  return events
    .map(event => ({ ...event, lokiMs: toMillis(event.date ?? event.startAt ?? event.startsAt ?? event.createdAt) }))
    .filter(event => !event.lokiMs || event.lokiMs >= now - 1000 * 60 * 60 * 24)
    .sort((a, b) => (a.lokiMs || Number.MAX_SAFE_INTEGER) - (b.lokiMs || Number.MAX_SAFE_INTEGER))
    .slice(0, 3);
}

export const EventExpert = {
  id: 'eventExpert',
  label: 'Event Expert',
  canHandle({ query }) {
    return includesAny(query, ['мероприят', 'событ', 'афиш', 'сегодня', 'интересн', 'выходн', 'куда сходить', 'встреч']);
  },
  handle({ context }) {
    const events = upcomingEvents(context.apg.events);
    if (!events.length) {
      const action = createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT);
      return {
        intent: 'event.empty',
        text: 'В АПГ пока нет информации о ближайших мероприятиях.',
        card: { title: 'Афиша мероприятий', text: 'Можно открыть раздел и проверить позже.', action, label: 'Открыть афишу' },
        cards: [],
      };
    }
    const first = events[0];
    const cards = events.map(event => makeResultCard(event, 'event', createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: event.id })));
    return {
      intent: 'event.upcoming',
      text: cards.length > 1
        ? `Нашёл ${cards.length} ближайших события. Первым посмотрел бы «${titleOf(first, 'мероприятие')}».`
        : `Я нашёл мероприятие «${titleOf(first, 'мероприятие')}». Оно выглядит хорошим вариантом для ближайшего времени.`,
      card: cards[0],
      cards,
    };
  },
};
