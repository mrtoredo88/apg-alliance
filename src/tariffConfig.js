export const PARTICIPANT_TYPES = [
  { id: 'partner', label: 'Бизнес-партнёр', description: 'Карточка компании, акции, контакты и возможности продвижения.' },
  { id: 'expert', label: 'Эксперт', description: 'Публичный профиль специалиста, услуги, запись и рекомендации Локи.' },
];

export const PARTNER_TARIFFS = [
  { id: 'start', label: 'Старт', description: 'Базовая карточка партнёра, контакты и акция для пользователей АПГ.', features: ['Карточка в каталоге', 'Контакты', 'Акция', 'Логотип и фото'] },
  { id: 'alliance', label: 'Альянс', description: 'Расширенная карточка, галерея, запись и видео.', features: ['Всё из Старт', 'Онлайн-запись', 'Галерея', 'Видео'] },
  { id: 'premium', label: 'Премиум', description: 'Расширенные возможности: новости, мероприятия и подготовка юридического профиля.', features: ['Всё из Альянс', 'Новости', 'Мероприятия', 'Юридические данные'] },
];

export const PARTNER_CATEGORIES = [
  { id: 'food', label: 'Еда' },
  { id: 'beauty', label: 'Красота' },
  { id: 'sport', label: 'Спорт' },
  { id: 'education', label: 'Обучение' },
  { id: 'entertainment', label: 'Развлечения' },
  { id: 'health', label: 'Здоровье' },
  { id: 'home', label: 'Дом и ремонт' },
  { id: 'pets', label: 'Животные' },
  { id: 'fashion', label: 'Одежда' },
  { id: 'auto', label: 'Авто' },
  { id: 'services', label: 'Услуги' },
  { id: 'shopping', label: 'Шоппинг' },
  { id: 'other', label: 'Другое' },
];

export const EXPERT_TARIFFS = [
  { id: 'practice', label: 'Практика', description: 'Профиль эксперта, услуги, контакты, фото, акция и запись.', features: ['Карточка эксперта', 'Услуги', 'Фото и видео', 'Онлайн-запись'] },
  { id: 'ambassador', label: 'Амбассадор', description: 'Максимальный экспертный формат: контент, мероприятия и расширенный профиль.', features: ['Всё из Практика', 'Новости', 'Мероприятия', 'Юридические данные'] },
];

export const EXPERT_AUDIENCE_TAGS = [
  { id: 'entrepreneurs', label: 'Предприниматели' },
  { id: 'self_employed', label: 'Самозанятые' },
  { id: 'families', label: 'Семьи' },
  { id: 'teenagers', label: 'Подростки' },
  { id: 'parents', label: 'Родители' },
  { id: 'seniors', label: 'Пенсионеры' },
  { id: 'residents', label: 'Все жители' },
  { id: 'specialists', label: 'Специалисты' },
];

export function normalizePartnerTariff(value) {
  const id = String(value || '').trim().toLowerCase();
  if (id === 'старт') return 'start';
  if (id === 'альянс') return 'alliance';
  if (id === 'премиум') return 'premium';
  return PARTNER_TARIFFS.some(item => item.id === id) ? id : 'start';
}

export function normalizeExpertTariff(value) {
  const id = String(value || '').trim().toLowerCase();
  if (id === 'практика') return 'practice';
  if (id === 'амбассадор') return 'ambassador';
  if (id === 'premium') return 'ambassador';
  if (id === 'standard' || id === 'basic' || id === 'start') return 'practice';
  return EXPERT_TARIFFS.some(item => item.id === id) ? id : 'practice';
}

export function hasPartnerPremiumAccess(tariff) {
  return normalizePartnerTariff(tariff) === 'premium';
}

export function hasPartnerAllianceAccess(tariff) {
  return ['alliance', 'premium'].includes(normalizePartnerTariff(tariff));
}

export function hasExpertAmbassadorAccess(tariff) {
  return normalizeExpertTariff(tariff) === 'ambassador';
}
