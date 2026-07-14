import { normalizeExternalUrl } from '../utils/externalUrls.js';

function text(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return text(value) ? String(value).split('\n').map(item => item.trim()).filter(Boolean) : [];
}

function videoList(profile = {}) {
  if (Array.isArray(profile.videos)) {
    return profile.videos.map(item => typeof item === 'string' ? { url: item, title: '' } : item).filter(item => item?.url);
  }
  return [];
}

export const SHOWCASE_TABS = [
  { id: 'showcase', label: 'Витрина', short: 'Витрина' },
  { id: 'media', label: 'Фото и видео', short: 'Медиа' },
  { id: 'contacts', label: 'Контакты и соцсети', short: 'Контакты' },
  { id: 'about', label: 'О бизнесе', short: 'О себе' },
  { id: 'content', label: 'Контент', short: 'Контент' },
  { id: 'analytics', label: 'Аналитика', short: 'Аналитика' },
  { id: 'client-view', label: 'Как видят клиенты', short: 'Клиенты' },
  { id: 'loki', label: 'Локи', short: 'Локи' },
];

export const SOCIAL_LINK_TYPES = [
  { id: 'telegram', label: 'Telegram', field: 'telegramUrl' },
  { id: 'whatsapp', label: 'WhatsApp', field: 'whatsappUrl' },
  { id: 'vk', label: 'VK', field: 'vkUrl' },
  { id: 'youtube', label: 'YouTube', field: 'youtubeUrl' },
  { id: 'rutube', label: 'Rutube', field: 'rutubeUrl' },
  { id: 'instagram', label: 'Instagram', field: 'instagramUrl' },
  { id: 'tiktok', label: 'TikTok', field: 'tiktokUrl' },
  { id: 'dzen', label: 'Дзен', field: 'dzenUrl' },
  { id: 'yandex-maps', label: 'Яндекс Карты', field: 'yandexMapsUrl' },
  { id: '2gis', label: '2ГИС', field: 'twoGisUrl' },
  { id: 'website', label: 'Сайт', field: 'websiteUrl' },
  { id: 'custom', label: 'Другая ссылка', field: '' },
];

export function moveShowcaseItem(items = [], index, direction) {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function buildShowcaseDraft(profile = {}, roleId = 'partner') {
  const primaryPhoto = profile.photo || profile.logoUrl || '';
  const gallery = [...list(profile.gallery), ...list(profile.photos)].filter((url, index, arr) => url && arr.indexOf(url) === index);
  const socialLinks = Array.isArray(profile.socialLinks) ? profile.socialLinks : SOCIAL_LINK_TYPES
    .filter(item => item.field && text(profile[item.field] || (item.id === 'vk' ? profile.socialUrl || profile.vkGroupUrl : '')))
    .map(item => ({
      id: item.id,
      type: item.id,
      label: item.label,
      url: text(profile[item.field] || (item.id === 'vk' ? profile.socialUrl || profile.vkGroupUrl : '')),
    }));

  return {
    roleId,
    name: text(profile.name),
    category: text(profile.category || profile.primaryCategory),
    categoryLabel: text(profile.categoryLabel),
    slogan: text(profile.slogan || profile.offer),
    shortDescription: text(profile.shortDescription || profile.specialization || profile.categoryLabel).slice(0, 140),
    description: text(profile.description),
    logoUrl: text(profile.logoUrl || profile.photo),
    photo: text(primaryPhoto),
    coverPhoto: text(profile.coverPhoto || profile.imageUrl),
    gallery,
    videos: videoList(profile),
    city: text(profile.city || 'Зеленоград'),
    district: text(profile.district),
    address: text(profile.address),
    hours: text(profile.hours || profile.workingHours),
    isOpenNow: Boolean(profile.isOpenNow),
    phone: text(profile.phone),
    email: text(profile.email),
    websiteUrl: text(profile.websiteUrl || profile.website),
    bookingUrl: text(profile.bookingUrl),
    vkUrl: text(profile.vkUrl || profile.socialUrl || profile.vkGroupUrl),
    telegramUrl: text(profile.telegramUrl),
    whatsappUrl: text(profile.whatsappUrl || profile.whatsapp),
    socialLinks,
    services: list(profile.services || profile.serviceDescription),
    directions: list(profile.directions),
    advantages: list(profile.advantages),
    prices: list(profile.prices || profile.serviceCost),
    paymentMethods: list(profile.paymentMethods),
    parking: text(profile.parking),
    delivery: text(profile.delivery),
    booking: text(profile.booking || profile.bookingUrl),
    features: list(profile.features),
    faq: Array.isArray(profile.faq) ? profile.faq : list(profile.faq).map(item => ({ question: item, answer: '' })),
    customerNotes: text(profile.customerNotes || profile.comment),
    education: text(profile.education),
    experience: text(profile.experience),
    certificates: list(profile.certificates),
    consultationPrice: text(profile.consultationPrice || profile.serviceCost),
    workFormat: text(profile.workFormat || list(profile.workFormats || profile.formats).join(', ')),
  };
}

export function buildShowcasePatch(draft = {}, roleId = 'partner') {
  const telegramUrl = normalizeExternalUrl(draft.telegramUrl, { platform: 'telegram' });
  const vkUrl = normalizeExternalUrl(draft.vkUrl, { platform: 'vk' });
  const websiteUrl = normalizeExternalUrl(draft.websiteUrl);
  const bookingUrl = normalizeExternalUrl(draft.bookingUrl);
  const whatsappUrl = normalizeExternalUrl(draft.whatsappUrl, { platform: 'whatsapp' });
  const socialLinks = (Array.isArray(draft.socialLinks) ? draft.socialLinks : []).map(item => {
    const type = text(item?.type || item?.id);
    const platform = type === 'telegram' ? 'telegram' : type === 'vk' ? 'vk' : type === 'whatsapp' ? 'whatsapp' : '';
    return {
      ...item,
      type,
      label: text(item?.label),
      url: normalizeExternalUrl(item?.url, platform ? { platform } : {}),
    };
  }).filter(item => item.url);
  const patch = {
    name: draft.name,
    category: draft.category,
    categoryLabel: draft.categoryLabel,
    slogan: draft.slogan,
    shortDescription: draft.shortDescription,
    description: draft.description,
    logoUrl: draft.logoUrl,
    photo: draft.photo,
    coverPhoto: draft.coverPhoto,
    gallery: draft.gallery || [],
    videos: draft.videos || [],
    city: draft.city,
    district: draft.district,
    address: draft.address,
    hours: draft.hours,
    workingHours: draft.hours,
    phone: draft.phone,
    email: draft.email,
    websiteUrl,
    bookingUrl,
    vkUrl,
    socialUrl: vkUrl || telegramUrl || websiteUrl,
    telegramUrl,
    whatsappUrl,
    socialLinks,
    services: draft.services || [],
    serviceDescription: (draft.services || []).join('\n'),
    directions: draft.directions || [],
    advantages: draft.advantages || [],
    prices: draft.prices || [],
    paymentMethods: draft.paymentMethods || [],
    parking: draft.parking,
    delivery: draft.delivery,
    booking: draft.booking,
    features: draft.features || [],
    faq: draft.faq || [],
    customerNotes: draft.customerNotes,
  };
  if (roleId === 'expert') {
    patch.specialization = draft.shortDescription;
    patch.education = draft.education;
    patch.experience = draft.experience;
    patch.certificates = draft.certificates || [];
    patch.consultationPrice = draft.consultationPrice;
    patch.serviceCost = draft.consultationPrice || (draft.prices || []).join('\n');
    patch.workFormat = draft.workFormat;
    patch.workFormats = draft.workFormat ? draft.workFormat.split(',').map(item => item.trim()).filter(Boolean) : [];
    patch.formats = patch.workFormats;
  } else {
    patch.offer = draft.slogan;
  }
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

export function calculateShowcaseCompletion(draft = {}, roleId = 'partner') {
  const checks = [
    { id: 'phone', label: 'Телефон', tab: 'contacts', done: Boolean(draft.phone) },
    { id: 'address', label: 'Адрес', tab: 'showcase', done: Boolean(draft.address || roleId === 'expert') },
    { id: 'description', label: 'Описание', tab: 'showcase', done: Boolean(draft.description) },
    { id: 'photos', label: 'Фотографии', tab: 'media', done: [draft.logoUrl, draft.photo, draft.coverPhoto, ...(draft.gallery || [])].filter(Boolean).length >= 3 },
    { id: 'video', label: 'Видео', tab: 'media', done: (draft.videos || []).length > 0 },
    { id: 'telegram', label: 'Telegram', tab: 'contacts', done: Boolean(draft.telegramUrl || (draft.socialLinks || []).some(item => item.type === 'telegram' && item.url)) },
    { id: 'hours', label: 'Часы работы', tab: 'showcase', done: Boolean(draft.hours || roleId === 'expert') },
    { id: 'faq', label: 'FAQ', tab: 'about', done: (draft.faq || []).some(item => item.question || item.answer) },
    { id: 'parking', label: 'Парковка', tab: 'about', done: Boolean(draft.parking || roleId === 'expert') },
    { id: 'prices', label: roleId === 'expert' ? 'Стоимость консультаций' : 'Цены', tab: 'about', done: Boolean(draft.consultationPrice || (draft.prices || []).length) },
  ];
  if (roleId === 'expert') {
    checks.push(
      { id: 'education', label: 'Образование', tab: 'about', done: Boolean(draft.education) },
      { id: 'experience', label: 'Опыт', tab: 'about', done: Boolean(draft.experience) },
    );
  }
  const doneCount = checks.filter(item => item.done).length;
  return {
    checks,
    doneCount,
    percent: Math.round(doneCount / Math.max(checks.length, 1) * 100),
  };
}

export function buildShowcaseLokiTips(draft = {}, roleId = 'partner') {
  const completion = calculateShowcaseCompletion(draft, roleId);
  return completion.checks.filter(item => !item.done).slice(0, 5).map(item => {
    const map = {
      photos: 'Добавьте ещё три фотографии: фасад, интерьер и результат работы.',
      video: 'Добавьте видео, чтобы клиенты быстрее поняли атмосферу и уровень доверия.',
      description: 'Заполните описание: кому вы полезны и почему стоит выбрать именно вас.',
      telegram: 'Добавьте Telegram, чтобы клиент мог быстро задать вопрос.',
      hours: 'Укажите часы работы, чтобы карточка выглядела завершённой.',
      faq: 'Добавьте FAQ: он снимает сомнения до первого обращения.',
      prices: roleId === 'expert' ? 'Укажите стоимость консультаций или диапазон цен.' : 'Добавьте цены или ориентиры, чтобы клиенту было проще решиться.',
    };
    return {
      id: item.id,
      title: item.label,
      text: map[item.id] || `Заполните раздел “${item.label}”.`,
      tab: item.tab,
    };
  });
}

export function buildShowcaseAnalytics(profile = {}, relatedEvents = []) {
  const views = Number(profile.viewCount ?? profile.views ?? 0) || 0;
  const qr = Number(profile.publicQRScans ?? 0) + Number(profile.qrOpenCount ?? profile.qrOpens ?? 0);
  return [
    { id: 'views', label: 'Просмотры', value: views },
    { id: 'routes', label: 'Маршруты', value: Number(profile.routeClicks ?? profile.mapRouteClicks ?? 0) || 0 },
    { id: 'calls', label: 'Звонки', value: Number(profile.phoneClicks ?? 0) || 0 },
    { id: 'qr', label: 'QR', value: qr },
    { id: 'reviews', label: 'Отзывы', value: Number(profile.reviewCount ?? 0) || 0 },
    { id: 'clients', label: 'Новые клиенты', value: Number(profile.totalVisits ?? 0) || 0 },
    { id: 'events', label: 'Мероприятия', value: relatedEvents.length },
  ];
}
