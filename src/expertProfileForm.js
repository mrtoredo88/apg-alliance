export const EXPERT_TARIFFS = [
  { id: 'basic', label: 'Базовый' },
  { id: 'premium', label: 'Премиум' },
  { id: 'ambassador', label: 'Амбассадор' },
];

export const EXPERT_CATEGORIES = [
  { id: 'law', label: 'Юриспруденция' },
  { id: 'psychology', label: 'Психология' },
  { id: 'finance', label: 'Финансы' },
  { id: 'marketing', label: 'Маркетинг' },
  { id: 'business', label: 'Бизнес' },
  { id: 'health', label: 'Здоровье' },
  { id: 'education', label: 'Образование' },
  { id: 'beauty', label: 'Красота' },
  { id: 'sport', label: 'Спорт' },
  { id: 'children', label: 'Дети и семья' },
  { id: 'career', label: 'Карьера' },
  { id: 'real_estate', label: 'Недвижимость' },
  { id: 'it', label: 'IT и цифровые услуги' },
  { id: 'creative', label: 'Творчество' },
  { id: 'other', label: 'Другое' },
];

export const EXPERT_WORK_FORMATS = [
  { id: 'online', label: 'Онлайн' },
  { id: 'offline', label: 'Офлайн' },
  { id: 'individual', label: 'Индивидуально' },
  { id: 'groups', label: 'Группы' },
  { id: 'onsite', label: 'Выезд' },
  { id: 'consultations', label: 'Консультации' },
];

export const EXPERT_SOCIAL_FIELDS = [
  { key: 'vkUrl', label: 'VK', platform: 'vk', placeholder: 'https://vk.com/...' },
  { key: 'telegramUrl', label: 'Telegram', platform: 'telegram', placeholder: 'https://t.me/...' },
  { key: 'maxUrl', label: 'MAX', platform: 'max', placeholder: 'https://...' },
  { key: 'instagramUrl', label: 'Instagram', platform: '', placeholder: 'https://instagram.com/...' },
  { key: 'youtubeUrl', label: 'YouTube', platform: '', placeholder: 'https://youtube.com/...' },
  { key: 'rutubeUrl', label: 'RuTube', platform: '', placeholder: 'https://rutube.ru/...' },
];

export const VIDEO_PLATFORMS = [
  { id: 'youtube', label: 'YouTube', match: value => /youtu\.be|youtube\.com/i.test(value) },
  { id: 'vk', label: 'VK Видео', match: value => /vk\.com\/video|vkvideo\.ru/i.test(value) },
  { id: 'rutube', label: 'RuTube', match: value => /rutube\.ru/i.test(value) },
  { id: 'max', label: 'MAX', match: value => /max\.ru|\.max\//i.test(value) },
];

export function hasPremiumExpertAccess(tariff) {
  return ['premium', 'ambassador'].includes(String(tariff || '').trim());
}

export function normalizeExpertVideo(url, title = '') {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) return null;
  const platform = VIDEO_PLATFORMS.find(item => item.match(cleanUrl));
  return {
    url: cleanUrl,
    title: String(title || '').trim(),
    platform: platform?.id || 'other',
    platformLabel: platform?.label || 'Видео',
  };
}

export function calculateExpertProfileCompletion(form = {}) {
  const checks = [
    Boolean(form.lastName?.trim()),
    Boolean(form.firstName?.trim()),
    Boolean(form.primaryCategory),
    Boolean(form.shortDescription?.trim()),
    Boolean(form.description?.trim()),
    Array.isArray(form.workFormats) && form.workFormats.length > 0,
    Boolean(form.offer?.trim()),
    Boolean(form.contactName?.trim()),
    Boolean(form.phone?.trim()),
    Boolean(form.email?.trim()),
    Boolean(form.photo?.trim()),
    Boolean(form.coverPhoto?.trim()),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function buildExpertAiSuggestions(form = {}) {
  const missing = [];
  if (!form.lastName?.trim() || !form.firstName?.trim()) missing.push('ФИО');
  if (!form.primaryCategory) missing.push('основная категория');
  if (!form.shortDescription?.trim()) missing.push('короткое описание');
  if (!form.description?.trim()) missing.push('подробное описание');
  if (!form.workFormats?.length) missing.push('форматы работы');
  if (!form.photo?.trim()) missing.push('фото профиля');
  const role = form.shortDescription?.trim() || EXPERT_CATEGORIES.find(c => c.id === form.primaryCategory)?.label || 'Эксперт АПГ';
  const name = [form.firstName, form.lastName].filter(Boolean).join(' ') || 'эксперт';
  return {
    missing,
    seoTitle: `${role} в АПГ — ${name}`.slice(0, 90),
    shortDescription: (form.shortDescription || role).slice(0, 120),
    improvedDescription: form.description?.trim()
      ? `${form.description.trim()}\n\nДля пользователей АПГ: помогу разобраться в задаче, выбрать понятный план действий и получить практический результат.`
      : 'Опишите, с кем вы работаете, какие задачи решаете и чем будете полезны пользователям АПГ.',
    categories: EXPERT_CATEGORIES.filter(c => [form.primaryCategory, ...(form.secondaryCategories || [])].includes(c.id)).map(c => c.label),
  };
}
