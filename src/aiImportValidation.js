const filled = value => Array.isArray(value) ? value.length > 0 : typeof value === 'object' && value !== null ? Object.values(value).some(filled) : Boolean(String(value ?? '').trim());

const videoUrl = item => typeof item === 'object' && item !== null ? String(item.url || '') : String(item || '');

// target: null — поле остаётся в заявке (контакт для администрации), не попадает в карточку и потерей не считается
const FIELD_MAPS = {
  expert: [
    ['title', ['name'], 'ФИО'],
    ['firstName', ['firstName'], 'Имя'],
    ['lastName', ['lastName'], 'Фамилия'],
    ['middleName', ['middleName'], 'Отчество'],
    ['shortDescription', ['specialization'], 'Короткое описание'],
    ['description', ['description'], 'Описание'],
    ['experience', ['experience'], 'Опыт'],
    ['services', ['services'], 'Услуги'],
    ['cost', ['serviceCost'], 'Стоимость услуг'],
    ['offer', ['offer'], 'Акция'],
    ['phone', ['phone'], 'Телефон'],
    ['email', ['email'], 'Email'],
    ['address', ['address'], 'Адрес'],
    ['hours', ['hours'], 'Часы работы'],
    ['website', ['websiteUrl'], 'Сайт'],
    ['bookingUrl', ['bookingUrl'], 'Ссылка на запись'],
    ['telegram', ['telegramUrl'], 'Telegram'],
    ['vk', ['vkUrl'], 'VK'],
    ['whatsapp', ['whatsappUrl'], 'WhatsApp'],
    ['max', ['maxUrl'], 'MAX'],
    ['otherSocials', ['otherSocials'], 'Другие соцсети'],
    ['categories', ['categories'], 'Категории'],
    ['workFormats', ['workFormats'], 'Форматы работы'],
    ['audienceTags', ['audienceTags'], 'Аудитория'],
    ['videos', ['videos'], 'Видео'],
    ['comment', ['adminComment'], 'Комментарий для администрации'],
    ['newsInfo', ['newsInfo'], 'Новости', { gate: 'тариф Амбассадор' }],
    ['activities', ['activities'], 'Мероприятия', { gate: 'тариф Амбассадор' }],
    ['inn', ['inn'], 'ИНН', { gate: 'тариф Амбассадор' }],
  ],
  partner: [
    ['title', ['name'], 'Название'],
    ['category', ['categoryLabel', 'category'], 'Категория'],
    ['shortDescription', ['shortDescription'], 'Короткое описание'],
    ['description', ['description'], 'Описание'],
    ['services', ['services'], 'Услуги'],
    ['offer', ['offer'], 'Акция'],
    ['gift', ['gift'], 'Подарок / бонус за ключи'],
    ['phone', ['phone'], 'Телефон'],
    ['email', ['email'], 'Email'],
    ['address', ['address'], 'Адрес'],
    ['hours', ['hours'], 'График работы'],
    ['website', ['websiteUrl'], 'Сайт'],
    ['telegram', ['telegramCommunityUrl'], 'Telegram'],
    ['vk', ['vkGroupUrl'], 'VK'],
    ['max', ['maxCommunityUrl'], 'MAX'],
    ['instagram', ['socialUrl'], 'Соцсеть'],
    ['comment', ['adminComment'], 'Комментарий для администрации'],
    ['bookingUrl', ['bookingUrl'], 'Ссылка на запись', { gate: 'тариф Альянс' }],
    ['videos', ['videos'], 'Видео', { gate: 'тариф Альянс' }],
    ['newsInfo', ['newsInfo'], 'Новости', { gate: 'тариф Премиум' }],
    ['activities', ['activities'], 'Мероприятия', { gate: 'тариф Премиум' }],
    ['inn', ['inn'], 'ИНН', { gate: 'тариф Премиум' }],
  ],
  event: [
    ['title', ['title'], 'Название'],
    ['date', ['date'], 'Дата'],
    ['address', ['location', 'address'], 'Место'],
    ['description', ['description'], 'Описание'],
    ['services', ['services'], 'Программа'],
    ['cost', ['cost'], 'Стоимость'],
    ['offer', ['offer'], 'Бонус'],
    ['website', ['socialUrl'], 'Ссылка'],
    ['source', ['partner'], 'Организатор'],
    ['category', ['category'], 'Категория'],
    ['comment', ['adminComment'], 'Комментарий для администрации'],
    ['phone', null, 'Телефон (хранится в заявке)'],
    ['email', null, 'Email (хранится в заявке)'],
    ['inn', null, 'ИНН (хранится в заявке)'],
    ['city', null, 'Город (хранится в заявке)'],
  ],
  news: [
    ['title', ['title'], 'Заголовок'],
    ['shortDescription', ['summary'], 'Анонс'],
    ['description', ['text', 'fullText'], 'Текст'],
    ['category', ['category'], 'Категория'],
    ['source', ['sourceName'], 'Источник'],
    ['website', ['linkUrl'], 'Ссылка'],
    ['videos', ['videos'], 'Видео'],
    ['comment', ['adminComment'], 'Комментарий для администрации'],
    ['phone', null, 'Телефон (хранится в заявке)'],
    ['email', null, 'Email (хранится в заявке)'],
    ['inn', null, 'ИНН (хранится в заявке)'],
    ['city', null, 'Город (хранится в заявке)'],
  ],
  prize: [
    ['title', ['name', 'title'], 'Название'],
    ['description', ['description'], 'Описание'],
    ['source', ['donorName'], 'Кто предоставляет'],
    ['date', ['raffleDate'], 'Дата розыгрыша'],
    ['cost', ['quantityInfo'], 'Количество / номинал'],
    ['comment', ['adminComment'], 'Комментарий для администрации'],
    ['phone', null, 'Телефон (хранится в заявке)'],
    ['email', null, 'Email (хранится в заявке)'],
    ['inn', null, 'ИНН (хранится в заявке)'],
    ['city', null, 'Город (хранится в заявке)'],
  ],
};

export function collectPatchMediaUrls(patch = {}) {
  return new Set([
    patch.photo,
    patch.coverPhoto,
    patch.logoUrl,
    patch.imageUrl,
    ...(Array.isArray(patch.gallery) ? patch.gallery : []),
    ...(Array.isArray(patch.photos) ? patch.photos : []),
  ].filter(Boolean));
}

export function buildAiImportValidation({ type, request = {}, patch = {} }) {
  const draftFields = request.draft?.fields || {};
  const sourceFiles = (Array.isArray(request.sourceFiles) ? request.sourceFiles : []).filter(file => file?.url);
  const patchMedia = collectPatchMediaUrls(patch);

  const mediaChecks = sourceFiles.map(file => ({
    name: file.name || file.url.split('/').pop(),
    url: file.url,
    role: file.role || 'photo',
    ok: patchMedia.has(file.url),
  }));
  const lostMedia = mediaChecks.filter(item => !item.ok);

  const draftVideos = (Array.isArray(draftFields.videos) ? draftFields.videos : []).map(videoUrl).filter(Boolean);
  const patchVideos = new Set((Array.isArray(patch.videos) ? patch.videos : []).map(videoUrl).filter(Boolean));
  const videoChecks = draftVideos.map(url => ({ url, ok: patchVideos.has(url) }));
  const lostVideos = videoChecks.filter(item => !item.ok);

  const gatedVideoDrop = lostVideos.length > 0 && (FIELD_MAPS[type] || []).some(([key, , , opts]) => key === 'videos' && opts?.gate) && !filled(patch.videos);

  const fieldChecks = (FIELD_MAPS[type] || FIELD_MAPS.partner).map(([draftKey, patchKeys, label, opts]) => {
    const draftValue = draftFields[draftKey];
    if (!filled(draftValue)) return { key: draftKey, label, status: 'empty' };
    if (patchKeys === null) return { key: draftKey, label, status: 'internal' };
    const kept = patchKeys.some(key => filled(patch[key]));
    if (kept) return { key: draftKey, label, status: 'ok' };
    if (opts?.gate) return { key: draftKey, label, status: 'tariff', gate: opts.gate };
    return { key: draftKey, label, status: 'lost' };
  });
  const lostFields = fieldChecks.filter(item => item.status === 'lost');
  const tariffDrops = fieldChecks.filter(item => item.status === 'tariff');

  const unknownCategories = Array.isArray(draftFields.unknownCategories) ? draftFields.unknownCategories.filter(Boolean) : [];

  const manifest = request.mediaManifest || null;
  const manifestIssues = [];
  if (manifest) {
    (manifest.rejected || []).forEach(item => manifestIssues.push(`«${item.name}» — ${item.reason}`));
    (manifest.failedOnClient || []).forEach(item => manifestIssues.push(`«${item.name}» — ${item.reason || 'ошибка при загрузке в анкете'}`));
    if (Number(manifest.accepted) < Number(manifest.declaredTotal)) manifestIssues.push(`В анкете заявлено файлов: ${manifest.declaredTotal}, дошло до заявки: ${manifest.accepted}`);
    if (Number(manifest.videosAccepted) < Number(manifest.videosDeclared)) manifestIssues.push(`В анкете заявлено видео: ${manifest.videosDeclared}, дошло: ${manifest.videosAccepted}`);
  }

  const blockers = [
    ...lostMedia.map(item => `Потеря медиафайла: «${item.name}» не попадает в карточку`),
    ...(gatedVideoDrop ? [] : lostVideos.map(item => `Потеря видео: ${item.url}`)),
    ...lostFields.map(item => `Потеря поля: ${item.label}`),
    ...manifestIssues.map(text => `Потеря на этапе анкеты: ${text}`),
    ...unknownCategories.map(value => `Категория «${value}» отсутствует в справочнике`),
  ];
  const warnings = [
    ...tariffDrops.map(item => `Поле «${item.label}» заполнено, но недоступно: ${item.gate}`),
    ...(gatedVideoDrop ? [`Видео (${lostVideos.length}) недоступны на выбранном тарифе`] : []),
  ];

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    mediaChecks,
    videoChecks,
    fieldChecks,
    unknownCategories,
    manifest,
    counts: {
      sourcePhotos: sourceFiles.length,
      patchPhotos: patchMedia.size,
      sourceVideos: draftVideos.length,
      patchVideos: patchVideos.size,
      fieldsFilled: fieldChecks.filter(item => item.status !== 'empty').length,
      fieldsKept: fieldChecks.filter(item => ['ok', 'internal'].includes(item.status)).length,
    },
  };
}
