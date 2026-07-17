import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => {
  console.error(`partner-deeplink-test: ${message}`);
  process.exit(1);
};

const userApp = read('src/UserApp.jsx');
const qrSection = read('src/PartnerQRSection.jsx');

if (!qrSection.includes("shareLink('partner', partner.id)")) {
  fail('public partner QR must be generated from shareLink(partner, partner.id)');
}

if (!/if\s*\(section === 'partner' && id\)\s*{[\s\S]*return \{ type: 'partner', id \};[\s\S]*}/.test(userApp)) {
  fail('readAppDeepLink must parse /partner/:id deep links');
}

if (!userApp.includes("if (deepLink.type === 'partner') return 'partners';")) {
  fail('partner deep links must not cold-start on the home panel');
}

if (!userApp.includes('const resolvePartnerDeepLink = useCallback(async (rawPartnerId) =>')) {
  fail('UserApp must use a dedicated partner deep-link resolver');
}

if (!userApp.includes("getDoc(doc(db, 'partners', partnerId))")) {
  fail('partner deep-link resolver must fetch the partner document directly when it is not in the cached catalog');
}

if (userApp.includes('if (!pendingPartnerId || !partners.length || deepLinkOpened.current) return;')) {
  fail('partner deep-link handling must not wait for the public partners list before resolving');
}

if (!userApp.includes('deepLinkOpened.current = true;') || !userApp.includes("showToast('🔍 Партнёр не найден', 'error')")) {
  fail('partner deep-link handling must distinguish successful open from definitive not found');
}

if (!userApp.includes("partner: { desktop: 'partners', mobile: 'offers' }")) {
  fail('partner public deep links must use the mobile partner catalog fallback instead of the desktop-only partners panel');
}

if (!userApp.includes('createPublicCardNavigationContext') || !userApp.includes('applyPublicCardBackStack')) {
  fail('public card navigation must use an explicit navigation context, not browser history heuristics');
}

if (!/openPartner\(partner,\s*\{[\s\S]*navigationContext: createPublicCardNavigationContext\('partner'/.test(userApp)) {
  fail('partner deep links must seed a public-card back stack before opening the partner profile');
}

if (!userApp.includes("panelHistoryRef.current = fallbackPanel === 'home' ? ['home'] : ['home', fallbackPanel];")) {
  fail('public-card back stack must be deterministic: home -> fallback -> card');
}

console.log('partner-deeplink-test: ok');
