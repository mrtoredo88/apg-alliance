function filled(value) {
  if (Array.isArray(value)) return value.filter(Boolean).length > 0;
  return Boolean(String(value ?? '').trim());
}

function count(value) {
  if (Array.isArray(value)) return value.filter(Boolean).length;
  return Number(value ?? 0) || 0;
}

function profileEvents(events = [], profile = {}, roleId = '') {
  if (!profile?.id) return [];
  return events.filter(event => {
    if (roleId === 'expert') return event.expertId === profile.id || event.submittedProfileId === profile.id || event.proposalAuthorType === 'expert' && event.submittedProfileName === profile.name;
    if (roleId === 'partner') return event.partnerId === profile.id || event.submittedProfileId === profile.id || event.proposalAuthorType === 'partner' && event.submittedProfileName === profile.name;
    return false;
  });
}

export function buildCabinetSnapshot({ role, profile, events = [], reviews = [] }) {
  const roleId = role?.id || 'user';
  const gallery = [...(Array.isArray(profile?.photos) ? profile.photos : []), ...(Array.isArray(profile?.gallery) ? profile.gallery : [])].filter(Boolean);
  const videos = Array.isArray(profile?.videos) ? profile.videos.filter(Boolean) : [];
  const relatedEvents = profileEvents(events, profile, roleId);
  const avgRating = Number(profile?.avgRating ?? 0) || 0;
  const reviewCount = Number(profile?.reviewCount ?? reviews.length ?? 0) || 0;
  const views = Number(profile?.viewCount ?? profile?.views ?? 0) || 0;
  const visits = Number(profile?.totalVisits ?? profile?.publicQRScans ?? 0) || 0;
  const contacts = {
    phone: profile?.phone || '',
    whatsapp: profile?.whatsappUrl || profile?.whatsapp || '',
    telegram: profile?.telegramUrl || profile?.telegram || '',
    vk: profile?.vkUrl || profile?.socialUrl || profile?.vkGroupUrl || '',
    max: profile?.maxUrl || '',
    website: profile?.websiteUrl || profile?.website || '',
    email: profile?.email || '',
    address: profile?.address || '',
    hours: profile?.hours || profile?.workingHours || '',
    booking: profile?.bookingUrl || '',
  };
  const completionChecks = [
    { id: 'name', label: 'Название или имя', done: filled(profile?.name), module: 'contacts' },
    { id: 'description', label: 'Описание', done: filled(profile?.description), module: 'contacts' },
    { id: 'media', label: 'Фото или обложка', done: filled(profile?.logoUrl || profile?.photo || profile?.coverPhoto) || gallery.length > 0, module: 'media' },
    { id: 'contacts', label: 'Контакты', done: Object.values(contacts).some(filled), module: 'contacts' },
    { id: 'offer', label: roleId === 'expert' ? 'Спецпредложение' : 'Акция', done: filled(profile?.offer), module: 'content' },
    { id: 'events', label: 'Мероприятия', done: relatedEvents.length > 0, module: 'content' },
  ];
  if (roleId === 'expert') {
    completionChecks.push(
      { id: 'services', label: 'Услуги', done: filled(profile?.services || profile?.serviceDescription), module: 'services' },
      { id: 'experience', label: 'Опыт', done: filled(profile?.experience), module: 'experience' },
      { id: 'booking', label: 'Онлайн-запись', done: filled(profile?.bookingUrl), module: 'booking' },
    );
  }
  if (roleId === 'partner') {
    completionChecks.push(
      { id: 'qr', label: 'QR-материалы', done: count(profile?.publicQRScans) > 0 || count(profile?.qrOpenCount) > 0, module: 'analytics' },
      { id: 'verified', label: 'Проверка АПГ', done: Boolean(profile?.verifiedPartner || profile?.lifecycleStatus === 'verified_partner'), module: 'settings' },
    );
  }
  const done = completionChecks.filter(item => item.done).length;
  return {
    roleId,
    profile,
    gallery,
    videos,
    reviews,
    relatedEvents,
    contacts,
    completionChecks,
    completion: Math.round(done / Math.max(completionChecks.length, 1) * 100),
    metrics: {
      views,
      uniqueVisitors: Number(profile?.uniqueVisitors ?? profile?.uniqueViewCount ?? 0) || 0,
      visits,
      publicQRScans: Number(profile?.publicQRScans ?? 0) || 0,
      qrOpens: Number(profile?.qrOpenCount ?? profile?.qrOpens ?? 0) || 0,
      calls: Number(profile?.phoneClicks ?? 0) || 0,
      telegram: Number(profile?.telegramClicks ?? 0) || 0,
      whatsapp: Number(profile?.whatsappClicks ?? 0) || 0,
      vk: Number(profile?.vkClicks ?? profile?.vkGroupClicks ?? 0) || 0,
      website: Number(profile?.websiteClicks ?? profile?.siteClicks ?? 0) || 0,
      map: Number(profile?.routeClicks ?? profile?.mapRouteClicks ?? 0) || 0,
      favorites: Number(profile?.favoritesCount ?? 0) || 0,
      reviews: reviewCount,
      rating: avgRating,
      news: Number(profile?.newsCount ?? (profile?.firstNewsCreatedAt ? 1 : 0)) || 0,
      events: relatedEvents.length,
      offers: filled(profile?.offer) ? 1 : 0,
      completion: Math.round(done / Math.max(completionChecks.length, 1) * 100),
    },
  };
}

export function buildCabinetTasks(snapshot) {
  const tasks = snapshot.completionChecks
    .filter(item => !item.done)
    .map(item => ({
      id: item.id,
      title: item.label,
      text: item.id === 'media' ? 'Добавьте качественные фотографии, чтобы карточка выглядела доверительно.' : item.id === 'contacts' ? 'Проверьте телефон, сайт, соцсети, адрес и часы работы.' : 'Этот пункт повышает готовность кабинета и качество карточки.',
      module: item.module,
      priority: item.id === 'contacts' || item.id === 'description' ? 'high' : 'normal',
    }));
  if (!snapshot.videos.length) tasks.push({ id: 'video', title: 'Добавьте видео', text: 'Видео уже поддержано архитектурно и будет усиливать доверие к карточке.', module: 'media', priority: 'normal' });
  if (snapshot.roleId === 'expert' && !filled(snapshot.profile?.bookingUrl)) tasks.push({ id: 'booking-extra', title: 'Добавьте ссылку на запись', text: 'Клиентам проще переходить сразу к записи, чем искать контакты вручную.', module: 'contacts', priority: 'high' });
  return tasks;
}

export function buildCabinetNotifications(snapshot) {
  const notifications = [];
  if (snapshot.metrics.reviews > 0) notifications.push({ id: 'reviews', title: 'Отзывы', text: `${snapshot.metrics.reviews} отзывов в карточке`, level: 'info' });
  if (snapshot.relatedEvents.length > 0) notifications.push({ id: 'events', title: 'Мероприятия', text: `${snapshot.relatedEvents.length} материалов связано с кабинетом`, level: 'info' });
  if (snapshot.completion < 70) notifications.push({ id: 'completion', title: 'Профиль требует внимания', text: `Заполненность ${snapshot.completion}%`, level: 'warning' });
  return notifications;
}

export function buildCabinetHistory(snapshot) {
  const items = [];
  if (snapshot.profile?.profileUpdatedAt) items.push({ id: 'profileUpdatedAt', title: 'Профиль обновлен', value: snapshot.profile.profileUpdatedAt });
  if (snapshot.profile?.createdAt) items.push({ id: 'createdAt', title: 'Кабинет создан', value: snapshot.profile.createdAt });
  if (snapshot.profile?.lastPartnerAiDraftAt) items.push({ id: 'aiDraft', title: 'AI создал черновик', value: snapshot.profile.lastPartnerAiDraftAt });
  return items;
}

export function getCabinetPublicUrl(snapshot) {
  if (!snapshot.profile?.id) return '';
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://myapg.ru';
  if (snapshot.roleId === 'expert') return `${origin}/?expert=${snapshot.profile.id}`;
  if (snapshot.roleId === 'partner') return `${origin}/?partner=${snapshot.profile.id}`;
  return origin;
}
