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

if (!userApp.includes("if (section === 'partner' && id) return { type: 'partner', id };")) {
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

console.log('partner-deeplink-test: ok');
