export const EXPERT_CATEGORIES = [
  { id: 'law', label: 'Юриспруденция', emoji: '⚖️', aliases: ['право', 'юрист', 'legal'] },
  { id: 'psychology', label: 'Психология', emoji: '🧠', aliases: ['психолог', 'коучинг'] },
  { id: 'finance', label: 'Финансы', emoji: '💰', aliases: ['финансовый консультант', 'налоги'] },
  { id: 'marketing', label: 'Маркетинг', emoji: '📣', aliases: ['продвижение', 'реклама'] },
  { id: 'business', label: 'Бизнес', emoji: '💼', aliases: ['предпринимательство', 'бизнес-консалтинг'] },
  { id: 'health', label: 'Здоровье', emoji: '🩺', aliases: ['медицина', 'нутрициология'] },
  { id: 'education', label: 'Образование', emoji: '📚', aliases: ['обучение', 'репетитор'] },
  { id: 'beauty', label: 'Красота', emoji: '💅', aliases: ['стиль', 'косметология'] },
  { id: 'sport', label: 'Спорт', emoji: '🏋️', aliases: ['фитнес', 'тренер'] },
  { id: 'children', label: 'Дети и семья', emoji: '🧸', aliases: ['kids', 'дети', 'семья'] },
  { id: 'career', label: 'Карьера', emoji: '🚀', aliases: ['профориентация', 'hr'] },
  { id: 'real_estate', label: 'Недвижимость', emoji: '🏠', aliases: ['риелтор', 'недвижимость'] },
  { id: 'it', label: 'IT и цифровые услуги', emoji: '💻', aliases: ['айти', 'digital', 'цифровые услуги'] },
  { id: 'creative', label: 'Творчество', emoji: '🎨', aliases: ['культура', 'искусство'] },
  { id: 'food', label: 'Еда и гастрономия', emoji: '🍳', aliases: ['еда', 'кулинария'] },
  { id: 'home', label: 'Дом и ремонт', emoji: '🔧', aliases: ['ремонт', 'дизайн интерьера'] },
  { id: 'pets', label: 'Животные', emoji: '🐾', aliases: ['питомцы', 'ветеринария'] },
  { id: 'fashion', label: 'Мода и стиль', emoji: '👔', aliases: ['одежда', 'мода'] },
  { id: 'auto', label: 'Авто', emoji: '🚙', aliases: ['автомобили'] },
  { id: 'insurance', label: 'Страхование', emoji: '🛡️', aliases: ['страховой эксперт'] },
  { id: 'photo', label: 'Фото и видео', emoji: '📸', aliases: ['фотография', 'видеография'] },
  { id: 'entertainment', label: 'Развлечения', emoji: '🎉', aliases: ['досуг'] },
  { id: 'other', label: 'Другое', emoji: '✨', aliases: [] },
];

let CATEGORY_BY_ID = new Map();
let CATEGORY_ALIAS = new Map();

function rebuildCategoryIndexes() {
  CATEGORY_BY_ID = new Map(EXPERT_CATEGORIES.map(item => [item.id, item]));
  CATEGORY_ALIAS = new Map(EXPERT_CATEGORIES.flatMap(item => [item.id, item.label, ...(item.aliases || [])].map(value => [String(value).trim().toLowerCase(), item.id])));
}

rebuildCategoryIndexes();

export function slugifyExpertCategoryId(label) {
  const translit = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  return String(label || '').trim().toLowerCase()
    .split('').map(char => translit[char] ?? char).join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function normalizeCustomExpertCategory(input = {}) {
  const label = String(input.label || '').trim().slice(0, 60);
  if (!label) return null;
  const id = slugifyExpertCategoryId(input.id || label);
  if (!id) return null;
  return {
    id,
    label,
    emoji: String(input.emoji || '✨').trim().slice(0, 8) || '✨',
    aliases: (Array.isArray(input.aliases) ? input.aliases : []).map(value => String(value || '').trim()).filter(Boolean).slice(0, 12),
    custom: true,
  };
}

export function registerCustomExpertCategories(list) {
  const items = (Array.isArray(list) ? list : []).map(normalizeCustomExpertCategory).filter(Boolean);
  let added = 0;
  items.forEach(item => {
    const existing = EXPERT_CATEGORIES.find(row => row.id === item.id);
    if (existing) {
      existing.label = item.label || existing.label;
      existing.emoji = item.emoji || existing.emoji;
      existing.aliases = [...new Set([...(existing.aliases || []), ...item.aliases])];
      return;
    }
    const otherIndex = EXPERT_CATEGORIES.findIndex(row => row.id === 'other');
    EXPERT_CATEGORIES.splice(otherIndex === -1 ? EXPERT_CATEGORIES.length : otherIndex, 0, item);
    added += 1;
  });
  if (items.length) rebuildCategoryIndexes();
  return added;
}

export function listCustomExpertCategories() {
  return EXPERT_CATEGORIES.filter(item => item.custom === true).map(item => ({ id: item.id, label: item.label, emoji: item.emoji, aliases: item.aliases || [] }));
}

export function normalizeExpertCategory(value, fallback = '') {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return fallback;
  return CATEGORY_ALIAS.get(key) || fallback;
}

export function getExpertCategory(value) {
  return CATEGORY_BY_ID.get(normalizeExpertCategory(value)) || null;
}

export function validateExpertCategories(values) {
  const input = (Array.isArray(values) ? values : [values]).map(value => String(value ?? '').trim()).filter(Boolean);
  const categories = [...new Set(input.map(value => normalizeExpertCategory(value)).filter(Boolean))];
  const unknown = input.filter(value => !normalizeExpertCategory(value));
  return { categories, unknown, valid: unknown.length === 0 && categories.length > 0 };
}

export function normalizeExpertPhone(value, defaultCountryCode = '7') {
  const raw = String(value ?? '').normalize('NFKC').trim();
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `${defaultCountryCode}${digits}`;
  if (digits.length < 11 || digits.length > 15) return '';
  return `+${digits}`;
}

export function getExpertTelHref(value) {
  const phone = normalizeExpertPhone(value);
  return phone ? `tel:${phone}` : '';
}

export function normalizeExpertRecord(value = {}) {
  const rawCategories = Array.isArray(value.categories) && value.categories.length
    ? value.categories
    : [value.category || value.primaryCategory, ...(Array.isArray(value.secondaryCategories) ? value.secondaryCategories : [])];
  const integrity = validateExpertCategories(rawCategories);
  const category = integrity.categories[0] || 'other';
  const phone = normalizeExpertPhone(value.phone || value.contactPhone || value.telephone);
  const workFormats = Array.isArray(value.workFormats) ? value.workFormats : Array.isArray(value.formats) ? value.formats : [];
  const formats = [...new Set(workFormats.map(format => ({ groups: 'group', consultations: 'individual', individual: 'individual', onsite: 'offline' }[format] || format)))];
  return {
    ...value,
    name: value.name || [value.lastName, value.firstName, value.middleName].filter(Boolean).join(' '),
    specialization: value.specialization || value.shortDescription || value.profession || '',
    category,
    categories: integrity.categories.length ? integrity.categories : [category],
    secondaryCategories: integrity.categories.slice(1),
    categoryIntegrity: integrity,
    phone,
    telHref: getExpertTelHref(phone),
    offer: value.offer || value.specialOffer || value.promo || value.actionText || '',
    photo: value.photo || value.avatar || value.avatarUrl || '',
    coverPhoto: value.coverPhoto || value.cover || value.cardCover || '',
    gallery: Array.isArray(value.gallery) ? value.gallery : Array.isArray(value.photos) ? value.photos : [],
    formats,
    workFormats,
    websiteUrl: value.websiteUrl || value.website || value.site || '',
    bookingUrl: value.bookingUrl || value.booking || value.appointmentUrl || '',
    telegramUrl: value.telegramUrl || value.telegram || '',
    vkUrl: value.vkUrl || value.vk || '',
    maxUrl: value.maxUrl || value.max || '',
    whatsappUrl: value.whatsappUrl || value.whatsapp || '',
    address: value.address || value.location || '',
    hours: value.hours || value.workingHours || '',
    experience: value.experience || value.experienceText || '',
    serviceCost: value.serviceCost || value.cost || value.price || '',
    latitude: Number(value.latitude ?? value.lat ?? value.coordinates?.lat) || null,
    longitude: Number(value.longitude ?? value.lng ?? value.lon ?? value.coordinates?.lng) || null,
  };
}
