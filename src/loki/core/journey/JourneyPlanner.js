import { JOURNEY_GOALS } from './GoalDetector.js';

const JOURNEY_TEMPLATES = {
  [JOURNEY_GOALS.BOOK_SERVICE]: [
    { id: 'choose_provider', title: 'выбрать партнёра или специалиста' },
    { id: 'choose_location', title: 'выбрать филиал', optional: true },
    { id: 'choose_service', title: 'выбрать услугу' },
    { id: 'choose_time', title: 'выбрать время' },
    { id: 'confirm', title: 'подтвердить запись' },
    { id: 'success', title: 'запись оформлена' },
  ],
  [JOURNEY_GOALS.FIND_PARTNER]: [
    { id: 'find_options', title: 'найти подходящие места' },
    { id: 'compare', title: 'сравнить лучшие варианты' },
    { id: 'open_profile', title: 'открыть карточку' },
    { id: 'next_action', title: 'выбрать действие' },
  ],
  [JOURNEY_GOALS.FIND_EXPERT]: [
    { id: 'find_options', title: 'найти специалистов' },
    { id: 'compare', title: 'выбрать лучшего кандидата' },
    { id: 'open_profile', title: 'открыть профиль' },
    { id: 'book_or_contact', title: 'записаться или связаться' },
  ],
  [JOURNEY_GOALS.JOIN_EVENT]: [
    { id: 'find_event', title: 'выбрать мероприятие' },
    { id: 'open_event', title: 'открыть карточку' },
    { id: 'register', title: 'перейти к регистрации' },
    { id: 'reminder', title: 'не забыть прийти' },
  ],
  [JOURNEY_GOALS.GET_PROMOTION]: [
    { id: 'find_promotion', title: 'найти акцию' },
    { id: 'check_terms', title: 'посмотреть условия' },
    { id: 'open_partner', title: 'открыть партнёра' },
    { id: 'use_offer', title: 'воспользоваться предложением' },
  ],
  [JOURNEY_GOALS.CLAIM_GIFT]: [
    { id: 'find_gift', title: 'выбрать подарок' },
    { id: 'check_keys', title: 'проверить ключи' },
    { id: 'open_gift', title: 'открыть карточку' },
    { id: 'claim', title: 'получить подарок' },
  ],
  [JOURNEY_GOALS.CONTACT_PARTNER]: [
    { id: 'find_contact', title: 'найти контакты' },
    { id: 'open_profile', title: 'открыть карточку' },
    { id: 'contact', title: 'связаться' },
  ],
  [JOURNEY_GOALS.NAVIGATE]: [
    { id: 'find_place', title: 'найти место' },
    { id: 'open_map', title: 'построить маршрут' },
  ],
  [JOURNEY_GOALS.LEARN]: [
    { id: 'find_info', title: 'найти информацию' },
    { id: 'explain', title: 'объяснить коротко' },
    { id: 'next_question', title: 'уточнить следующий вопрос' },
  ],
  [JOURNEY_GOALS.GENERAL]: [
    { id: 'understand', title: 'понять запрос' },
    { id: 'suggest_next', title: 'предложить следующий шаг' },
  ],
};

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function createJourneyPlan(goal = JOURNEY_GOALS.GENERAL, top = null) {
  const steps = list(JOURNEY_TEMPLATES[goal] || JOURNEY_TEMPLATES[JOURNEY_GOALS.GENERAL]);
  const hasMultipleLocations = list(top?.locations).length > 1 || top?.type === 'location';
  return steps
    .filter(step => !step.optional || hasMultipleLocations)
    .map((step, index) => ({ ...step, index, status: index === 0 ? 'current' : 'pending' }));
}

export function goalLabel(goal) {
  return {
    [JOURNEY_GOALS.BOOK_SERVICE]: 'запись',
    [JOURNEY_GOALS.FIND_PARTNER]: 'поиск партнёра',
    [JOURNEY_GOALS.FIND_EXPERT]: 'поиск специалиста',
    [JOURNEY_GOALS.JOIN_EVENT]: 'мероприятие',
    [JOURNEY_GOALS.GET_PROMOTION]: 'акция',
    [JOURNEY_GOALS.CLAIM_GIFT]: 'подарок',
    [JOURNEY_GOALS.CONTACT_PARTNER]: 'контакт',
    [JOURNEY_GOALS.NAVIGATE]: 'маршрут',
    [JOURNEY_GOALS.LEARN]: 'объяснение',
    [JOURNEY_GOALS.GENERAL]: 'запрос',
  }[goal] || 'запрос';
}
