export function safeStringList(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}

export function collectUserIdentityIds(userData = {}) {
  return [...new Set([
    userData.id,
    userData.uid,
    userData.firebaseUid,
    userData.authUid,
    userData.vkId,
    userData.vkUserId,
    userData.telegramId,
    userData.tgId,
    userData.linkedTelegram?.tgId,
  ].map(item => String(item || '').trim()).filter(Boolean))];
}

export function collectUserEmails(userData = {}, fallbackEmail = '') {
  return [...new Set([
    userData.email,
    userData.linkedEmail,
    userData.normalizedEmail,
    fallbackEmail,
  ].map(item => String(item || '').trim().toLowerCase()).filter(Boolean))];
}

export function profileOwnedByUser(profile, userData, fallbackEmail = '') {
  if (!profile || !userData) return false;
  const userIds = collectUserIdentityIds(userData);
  const emails = collectUserEmails(userData, fallbackEmail);
  const ownerUserIds = safeStringList(profile.ownerUserIds);
  const ownerEmails = safeStringList(profile.ownerEmails).map(item => item.toLowerCase());
  const userCabinetIds = [...safeStringList(userData.partnerCabinetIds), ...safeStringList(userData.expertCabinetIds)];
  return userIds.some(id => (
    String(profile.ownerId || '') === id
    || String(profile.vkOwnerId || '') === id
    || ownerUserIds.includes(id)
  ))
    || emails.some(email => (
      String(profile.ownerEmail || '').toLowerCase() === email
      || String(profile.connectionEmail || '').toLowerCase() === email
      || ownerEmails.includes(email)
    ))
    || userCabinetIds.includes(String(profile.id || ''));
}

export function buildCabinetDiagnostics({ userData = {}, ownedPartner = null, ownedExpert = null, partners = [], role = '' } = {}) {
  const userIds = collectUserIdentityIds(userData);
  const emails = collectUserEmails(userData);
  const partnerCabinetIds = safeStringList(userData.partnerCabinetIds);
  const expertCabinetIds = safeStringList(userData.expertCabinetIds);
  const roles = [...new Set([role, userData.role, ...(Array.isArray(userData.roles) ? userData.roles : [])].map(item => String(item || '').trim()).filter(Boolean))];

  const partnerReasons = [];
  if (!ownedPartner) {
    if (userData.partnerId || partnerCabinetIds.length) {
      const wanted = String(userData.partnerId || partnerCabinetIds[0]);
      const inCatalog = partners.find(item => String(item.id) === wanted);
      if (!inCatalog) partnerReasons.push(`Привязка к партнёру ${wanted} есть, но карточка не найдена в каталоге (не опубликована, в архиве или удалена).`);
      else partnerReasons.push(`Партнёр ${wanted} найден, но не распознан как ваш — сообщите администратору.`);
    } else {
      partnerReasons.push(`На активном профиле (${userData.id || 'без id'}) нет привязки: поля partnerId и partnerCabinetIds пустые.`);
      partnerReasons.push('Если администратор выполнял привязку — она могла попасть на другой ваш профиль (VK / Telegram / email). Передайте администратору ID выше.');
    }
  }
  const expertReasons = [];
  if (!ownedExpert) {
    if (userData.expertId || expertCabinetIds.length) expertReasons.push(`Привязка к эксперту ${userData.expertId || expertCabinetIds[0]} есть, но карточка не найдена или не распознана.`);
    else expertReasons.push('На активном профиле нет привязки к карточке эксперта.');
  }

  return {
    userId: String(userData.id || ''),
    firebaseUid: String(userData.firebaseUid || userData.uid || ''),
    identityIds: userIds,
    emails,
    roles: roles.length ? roles : ['user'],
    partnerId: String(userData.partnerId || ''),
    partnerCabinetIds,
    expertId: String(userData.expertId || ''),
    expertCabinetIds,
    cabinets: [
      { key: 'partner', label: 'Кабинет партнёра', available: Boolean(ownedPartner), source: ownedPartner ? `${ownedPartner.name || ownedPartner.id}` : '', reasons: partnerReasons },
      { key: 'expert', label: 'Кабинет эксперта', available: Boolean(ownedExpert), source: ownedExpert ? `${ownedExpert.name || ownedExpert.id}` : '', reasons: expertReasons },
      { key: 'admin', label: 'Админ-панель', available: roles.some(item => ['owner', 'super_admin', 'admin', 'moderator', 'editor'].includes(item)), source: roles.join(', '), reasons: roles.length ? [] : ['Нет административной роли.'] },
    ],
  };
}
