function text(value) {
  return String(value || '').trim();
}

function hasCover(event = {}) {
  return Boolean(text(event.coverPhoto || event.coverUrl || event.cover || event.imageUrl || event.thumbnail || event.banner || event.image || event.photo)
    || (Array.isArray(event.photos) && event.photos.some(Boolean))
    || (Array.isArray(event.images) && event.images.some(Boolean)));
}

function hasOrganizer(event = {}) {
  return Boolean(text(event.partner || event.organizer || event.organizerName || event.expert) || event.partnerId || event.expertId);
}

function hasDate(event = {}) {
  return Boolean(event.startAt || event.startsAt || event.eventDate || event.date);
}

export function eventPublicationReadiness(event = {}) {
  const description = text(event.description || event.fullDescription || event.details || event.text);
  const blockers = [];
  const warnings = [];

  if (!text(event.title || event.name)) blockers.push({ code: 'title', label: 'Не указано название' });
  if (!hasCover(event)) blockers.push({ code: 'cover', label: 'Не добавлена обложка' });
  if (!hasOrganizer(event)) blockers.push({ code: 'organizer', label: 'Не указан организатор' });
  if (!description) blockers.push({ code: 'description', label: 'Не добавлено описание' });
  if (!hasDate(event)) blockers.push({ code: 'date', label: 'Не указаны дата и время' });

  if (description && description.length < 80) warnings.push({ code: 'short_description', label: 'Описание короче 80 символов' });
  if (!text(event.category)) warnings.push({ code: 'category', label: 'Не указана категория' });
  if (!text(event.address || event.location) && text(event.locationMode || event.mode).toLowerCase() !== 'online') {
    warnings.push({ code: 'location', label: 'Не указан адрес или онлайн-формат' });
  }

  return { ready: blockers.length === 0, blockers, warnings };
}

