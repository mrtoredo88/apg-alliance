const PHRASES = {
  professional: {
    success: ['Готово. Можно переходить к следующему шагу.'],
    waiting: ['Проверяю данные — это займёт немного времени.'],
  },
  friendly: {
    success: ['Готово — ещё одна задача аккуратно закрыта.'],
    waiting: ['Секунду, собираю всё нужное в один ответ.'],
    night: ['Ночная смена принята. Работаем спокойно и без лишнего шума.'],
  },
  charismatic: {
    success: ['Готово. Красиво, точно и без лишней магии.'],
    waiting: ['Собираю факты. Даже Локи иногда полезно всё перепроверить.'],
    deploy: ['Деплой прошёл. Серверы спокойны, можно выдохнуть.'],
  },
};

function stableIndex(seed, length) {
  return [...String(seed || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % length;
}

export const HumorEngine = {
  id: 'humorEngine',
  pick({ event, style = 'friendly', critical = false, seed = '' } = {}) {
    if (critical) return null;
    const hour = new Date().getHours();
    const key = hour < 6 && PHRASES[style]?.night ? 'night' : event;
    const options = PHRASES[style]?.[key] || PHRASES.friendly[key] || [];
    return options.length ? options[stableIndex(seed, options.length)] : null;
  },
};
