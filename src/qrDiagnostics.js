const QR_LOG_PREFIX = '[QR]';
const MAX_QR_LOGS = 80;

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true
  );
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractPartnerIdFromLocation() {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const hashPath = window.location.hash.startsWith('#/')
    ? window.location.hash.slice(1).split('?')[0]
    : window.location.hash.startsWith('#')
      ? window.location.hash.slice(1).split('?')[0]
      : '';
  const sourcePath = path === '/' && hashPath ? hashPath : path;
  const parts = sourcePath.split('/').filter(Boolean).map(safeDecode);
  if (parts[0] === 'partner' && parts[1]) return parts[1];

  try {
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.slice(window.location.hash.indexOf('?') + 1) : '';
    const params = new URLSearchParams(
      window.location.search || hashQuery
        ? `${window.location.search.replace(/^\?/, '')}${window.location.search && hashQuery ? '&' : ''}${hashQuery}`
        : ''
    );
    return params.get('partner') || params.get('partnerId') || '';
  } catch {
    return '';
  }
}

function trimText(value, max = 120) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function arrayCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function pushQrLog(payload) {
  if (typeof window === 'undefined') return;
  try {
    const list = Array.isArray(window.__APG_QR_DIAGNOSTICS__) ? window.__APG_QR_DIAGNOSTICS__ : [];
    const next = [...list, payload].slice(-MAX_QR_LOGS);
    window.__APG_QR_DIAGNOSTICS__ = next;
    sessionStorage.setItem('apg_qr_last_context', JSON.stringify(payload).slice(0, 7000));
  } catch {}
}

export function getQrRouteContext(extra = {}) {
  if (typeof window === 'undefined') return { ...extra };
  return {
    url: window.location.href,
    partnerId: extra.partnerId || extractPartnerIdFromLocation(),
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    isPWA: isStandalonePwa(),
    userAgent: window.navigator?.userAgent || '',
    currentPanel: window.__APG_CURRENT_PANEL__ || '',
    currentSection: window.__APG_CURRENT_SECTION__ || '',
    ...extra,
  };
}

export function sanitizeQrPartnerSnapshot(partner) {
  if (!partner || typeof partner !== 'object') return null;
  const locations = Array.isArray(partner.locations) ? partner.locations : [];
  const serviceCatalog = Array.isArray(partner.serviceCatalog) ? partner.serviceCatalog : [];
  return {
    id: String(partner.id || ''),
    title: trimText(partner.name || partner.title || partner.companyName || ''),
    status: partner.status || partner.lifecycleStatus || '',
    catalogPublished: partner.catalogPublished,
    locations: {
      count: locations.length,
      hasMain: locations.some(item => item?.isMain),
      fallbackAddress: Boolean(partner.address),
    },
    media: {
      cover: Boolean(partner.cover || partner.heroImage || partner.coverImage),
      logo: Boolean(partner.logo || partner.logoUrl),
      photos: arrayCount(partner.photos),
      gallery: arrayCount(partner.gallery),
      images: arrayCount(partner.images),
      videos: arrayCount(partner.videos),
    },
    services: {
      text: Boolean(partner.services || partner.serviceDescription),
      catalog: serviceCatalog.length,
    },
  };
}

export function qrLog(stage, data = {}) {
  if (typeof window === 'undefined') return;
  const payload = {
    at: new Date().toISOString(),
    stage,
    ...getQrRouteContext(data),
  };
  try {
    console.info(QR_LOG_PREFIX, stage, payload);
  } catch {}
  pushQrLog(payload);
}

export function qrError(stage, error, data = {}) {
  if (typeof window === 'undefined') return;
  const payload = {
    at: new Date().toISOString(),
    stage,
    ...getQrRouteContext(data),
    error: error?.message || String(error || ''),
    stack: String(error?.stack || '').slice(0, 4000),
  };
  try {
    console.error(QR_LOG_PREFIX, stage, payload);
  } catch {}
  pushQrLog(payload);
}
