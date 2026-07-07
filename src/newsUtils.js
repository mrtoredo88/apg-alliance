export const NEWS_CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'apg', label: 'Новости АПГ' },
  { id: 'city', label: 'Новости города' },
  { id: 'useful', label: 'Полезные статьи' },
  { id: 'updates', label: 'Обновления' },
  { id: 'events', label: 'Мероприятия' },
  { id: 'partners', label: 'Партнёры' },
  { id: 'experts', label: 'Эксперты' },
  { id: 'offers', label: 'Акции' },
  { id: 'raffles', label: 'Розыгрыши' },
  { id: 'success', label: 'Истории' },
  { id: 'video', label: 'Видео' },
];

export const NEWS_SORTS = [
  { id: 'new', label: 'Новые' },
  { id: 'popular', label: 'Популярные' },
  { id: 'discussed', label: 'Обсуждаемые' },
  { id: 'video', label: 'Видео' },
  { id: 'today', label: 'За сегодня' },
  { id: 'week', label: 'За неделю' },
  { id: 'month', label: 'За месяц' },
];

const CATEGORY_ALIASES = {
  app: 'updates',
  update: 'updates',
  апг: 'apg',
  event: 'events',
  мероприятие: 'events',
  partner: 'partners',
  партнёр: 'partners',
  партнер: 'partners',
  expert: 'experts',
  эксперт: 'experts',
  offer: 'offers',
  акция: 'offers',
  promo: 'offers',
  raffle: 'raffles',
  prize: 'raffles',
  розыгрыш: 'raffles',
  приз: 'raffles',
  city: 'city',
  город: 'city',
  useful: 'useful',
  статья: 'useful',
  story: 'success',
  success: 'success',
  vk: 'apg',
  vkontakte: 'apg',
};

export function getNewsImage(item) {
  return item?.coverPhoto || item?.imageUrl || item?.thumbnail || item?.banner || item?.image || item?.photo || item?.photos?.[0] || item?.gallery?.[0] || '';
}

export function getNewsPhotos(item) {
  const values = [
    ...(Array.isArray(item?.photos) ? item.photos : []),
    ...(Array.isArray(item?.gallery) ? item.gallery : []),
    item?.coverPhoto,
    item?.imageUrl,
  ].filter(Boolean);
  return [...new Set(values)];
}

export function getNewsVideos(item) {
  const videos = Array.isArray(item?.videos) ? item.videos : [];
  if (videos.length) return videos;
  if (item?.videoUrl) return [{ platform: 'vk', url: item.videoUrl, embedUrl: item.videoUrl, thumbnailUrl: item.thumbnail || '/video-placeholder-vk.svg', title: item.title || 'Видео' }];
  return [];
}

export function getNewsLinks(item) {
  const links = Array.isArray(item?.links) ? item.links : [];
  const url = getNewsUrl(item);
  if (!url) return links;
  if (links.some(link => link.url === url)) return links;
  return [...links, { type: 'link', url, title: item?.linkLabel || 'Источник' }];
}

export function getNewsDocs(item) {
  return Array.isArray(item?.docs) ? item.docs : [];
}

export function getNewsText(item) {
  return String(item?.text || item?.description || item?.excerpt || item?.body || '').trim();
}

export function getNewsTitle(item) {
  return String(item?.title || item?.name || 'Новость АПГ').trim();
}

export function getNewsDate(item) {
  const raw = item?.publishedAt ?? item?.createdAt ?? item?.date ?? item?.timestamp ?? null;
  if (!raw) return null;
  if (raw.toDate) return raw.toDate();
  if (raw.seconds) return new Date(raw.seconds * 1000);
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getNewsCategory(item) {
  if (item?.source === 'vk' || item?.vkUrl || item?.postUrl) return 'apg';
  if (item?.videoUrl || item?.video || item?.videos?.length) return 'video';
  const raw = String(item?.category || item?.type || '').trim().toLowerCase();
  if (!raw) {
    const text = `${getNewsTitle(item)} ${getNewsText(item)}`.toLowerCase();
    if (/партн[её]р|откры/.test(text)) return 'partners';
    if (/эксперт|консультац/.test(text)) return 'experts';
    if (/мероприят|афиш|встреч|фестивал/.test(text)) return 'events';
    if (/скидк|акци|предлож/.test(text)) return 'offers';
    if (/обновлен|верс|релиз|приложен/.test(text)) return 'updates';
    return 'apg';
  }
  return CATEGORY_ALIASES[raw] || raw;
}

export function getNewsCategoryLabel(item) {
  const category = getNewsCategory(item);
  return NEWS_CATEGORIES.find(c => c.id === category)?.label || 'Новости АПГ';
}

export function getNewsTimestamp(item) {
  return getNewsDate(item)?.getTime() || 0;
}

export function formatNewsDate(item) {
  const date = getNewsDate(item);
  if (!date) return 'Недавно';
  const diff = Date.now() - date.getTime();
  if (diff < 60 * 60 * 1000) return 'только что';
  if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 3600000))} ч назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function isFreshNews(item) {
  const ts = getNewsTimestamp(item);
  return ts > 0 && Date.now() - ts < 24 * 60 * 60 * 1000;
}

export function getReadingMinutes(item) {
  const words = getNewsText(item).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 170));
}

export function getNewsViews(item) {
  return Number(item?.views ?? item?.viewCount ?? item?.opens ?? item?.stats?.views ?? 0) || 0;
}

export function getNewsStats(item) {
  const stats = item?.stats || {};
  return {
    views: getNewsViews(item),
    likes: Number(stats.likes ?? item?.likes ?? 0) || 0,
    comments: Number(stats.comments ?? item?.comments ?? 0) || 0,
    reposts: Number(stats.reposts ?? item?.reposts ?? 0) || 0,
  };
}

export function getNewsReactionsTotal(item) {
  const reactions = item?.reactions || {};
  return Object.values(reactions).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function hasNewsVideo(item) {
  const value = `${item?.videoUrl || ''} ${item?.linkUrl || ''} ${getNewsText(item)}`.toLowerCase();
  return Boolean(item?.video || getNewsVideos(item).length || /youtube|youtu\.be|vk\.com\/video|rutube|video/.test(value));
}

export function getNewsUrl(item) {
  return item?.linkUrl || item?.url || item?.vkUrl || item?.postUrl || '';
}

export function sortNewsItems(items, sortId = 'new') {
  const now = Date.now();
  const filtered = items.filter(item => {
    const ts = getNewsTimestamp(item);
    if (sortId === 'video') return hasNewsVideo(item);
    if (sortId === 'today') return ts && now - ts < 24 * 60 * 60 * 1000;
    if (sortId === 'week') return ts && now - ts < 7 * 24 * 60 * 60 * 1000;
    if (sortId === 'month') return ts && now - ts < 31 * 24 * 60 * 60 * 1000;
    return true;
  });
  return [...filtered].sort((a, b) => {
    const urgent = Number(Boolean(b.isUrgent || (b.priority ?? 0) >= 9)) - Number(Boolean(a.isUrgent || (a.priority ?? 0) >= 9));
    if (urgent) return urgent;
    const pinned = Number(Boolean(b.pinned || b.isPinned)) - Number(Boolean(a.pinned || a.isPinned));
    if (pinned) return pinned;
    if (sortId === 'popular') return getNewsViews(b) - getNewsViews(a) || getNewsTimestamp(b) - getNewsTimestamp(a);
    if (sortId === 'discussed') return getNewsReactionsTotal(b) - getNewsReactionsTotal(a) || getNewsTimestamp(b) - getNewsTimestamp(a);
    const priority = (Number(b.priority) || 0) - (Number(a.priority) || 0);
    return priority || getNewsTimestamp(b) - getNewsTimestamp(a);
  });
}

export function filterNewsItems(items, categoryId, queryText) {
  const q = String(queryText || '').trim().toLowerCase();
  return items.filter(item => {
    const categoryOk = !categoryId || categoryId === 'all' || getNewsCategory(item) === categoryId;
    if (!categoryOk) return false;
    if (!q) return true;
    return `${getNewsTitle(item)} ${getNewsText(item)} ${getNewsCategoryLabel(item)} ${(item?.tags || []).join(' ')}`.toLowerCase().includes(q);
  });
}
