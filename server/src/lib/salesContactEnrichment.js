import { lookupSalesLead } from './salesScout.js';
import { findOsmBusiness } from './salesOsmContacts.js';

const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const SOCIAL_HOSTS = new Set(['vk.com', 'www.vk.com', 't.me', 'telegram.me']);

function safePublicUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    return url;
  } catch { return null; }
}

function contactsFromHtml(html = '', baseUrl = '') {
  const text = String(html).slice(0, 2_000_000);
  const emails = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map(match => match[0].toLowerCase())
    .filter(email => !/\.(png|jpg|jpeg|gif|webp|svg)$/.test(email));
  const links = [...text.matchAll(/href=["']([^"']+)["']/gi)].map(match => match[1]);
  let vk = '';
  let telegram = '';
  for (const href of links) {
    let url;
    try { url = new URL(href, baseUrl); } catch { continue; }
    if (!SOCIAL_HOSTS.has(url.hostname.toLowerCase())) continue;
    if (url.hostname.toLowerCase().includes('vk.com') && !vk) vk = url.toString();
    if (['t.me', 'telegram.me'].includes(url.hostname.toLowerCase()) && !telegram) telegram = url.toString();
  }
  return { email: emails[0] || '', vk, telegram };
}

async function fetchWebsiteContacts(website) {
  const url = safePublicUrl(website);
  if (!url) return {};
  const response = await fetch(url, { redirect: 'follow', headers: { Accept: 'text/html', 'User-Agent': 'APG-Sales-Contact-Enricher/1.0' }, signal: AbortSignal.timeout(9000) });
  const type = response.headers.get('content-type') || '';
  const length = Number(response.headers.get('content-length') || 0);
  if (!response.ok || !type.includes('text/html') || length > 2_000_000) return {};
  return contactsFromHtml(await response.text(), response.url || url.toString());
}

export async function enrichSalesLeadContacts(lead = {}) {
  const [provider, osm] = await Promise.all([
    lookupSalesLead(lead).catch(() => null),
    findOsmBusiness(lead).catch(() => null),
  ]);
  const website = clean(provider?.website || osm?.website || lead.website, 1500);
  const web = website ? await fetchWebsiteContacts(website).catch(() => ({})) : {};
  const patch = {
    contact: clean(provider?.contact || osm?.phone || lead.contact, 300),
    website,
    email: clean(provider?.email || osm?.email || web.email || lead.email, 320),
    vk: clean(provider?.vk || osm?.vk || web.vk || lead.vk, 1500),
    telegram: clean(provider?.telegram || osm?.telegram || web.telegram || lead.telegram, 1500),
    contactEnrichedAt: new Date().toISOString(),
    contactEnrichmentSource: [provider ? '2gis' : '', osm ? 'openstreetmap' : '', web.email || web.vk || web.telegram ? 'website' : ''].filter(Boolean).join('+') || 'none',
    osmExternalId: clean(osm?.externalId, 180),
  };
  return { patch, found: ['email', 'vk', 'telegram', 'contact'].filter(key => Boolean(patch[key])) };
}

export const __test = { contactsFromHtml };
