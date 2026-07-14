import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const partnersSource = fs.readFileSync(path.join(root, 'src/PartnersPage.jsx'), 'utf8');
const userAppSource = fs.readFileSync(path.join(root, 'src/UserApp.jsx'), 'utf8');
const homeSource = fs.readFileSync(path.join(root, 'src/HomePanelV2.jsx'), 'utf8');

const requiredFrameworkComponents = [
  'DesktopTopOverview',
  'DesktopSectionShell',
  'DesktopHeader',
  'DesktopToolbar',
  'DesktopKpiStrip',
  'DesktopContentGrid',
  'DesktopActionBar',
  'DesktopMetricCard',
  'DesktopSidebarCard',
  'DesktopEmptyState',
  'DesktopSkeleton',
  'DesktopSectionTitle',
];

for (const name of requiredFrameworkComponents) {
  if (!partnersSource.includes(name)) {
    throw new Error(`PartnersPage desktop experience must use ${name}`);
  }
}

if (!partnersSource.includes("from './components/DesktopUI.jsx'")) {
  throw new Error('PartnersPage must use the shared Desktop UI Framework.');
}

if (!partnersSource.includes('desktopMode = false') || !partnersSource.includes('<DesktopTopOverview')) {
  throw new Error('PartnersPage must keep desktop rendering explicit and use the shared top overview.');
}

if (partnersSource.includes('rightRail=') || partnersSource.includes('DesktopRightRail')) {
  throw new Error('PartnersPage must not use a permanent right rail.');
}

if (!userAppSource.includes("const PartnersPage") || !userAppSource.includes('<Panel id="partners">')) {
  throw new Error('UserApp must expose a separate partners panel.');
}

if (!userAppSource.includes("goPanel('partners')") || !userAppSource.includes("goPanel('offers')")) {
  throw new Error('UserApp must keep Partners and Offers as separate routes.');
}

if (!userAppSource.includes('const handleOpenPartners = useCallback') || !userAppSource.includes('[LOKI_APP_ACTIONS.OPEN_PARTNERS]: handleOpenPartners')) {
  throw new Error('UserApp must expose one shared handleOpenPartners route for Desktop Home, overview navigation and Loki.');
}

if (!userAppSource.includes('desktopOverview={desktopOverview}') || !userAppSource.includes('desktopMode={desktopDevice}')) {
  throw new Error('UserApp must pass desktop overview and desktopMode to PartnersPage.');
}

if (!homeSource.includes('onOpenPartners,') || !homeSource.includes('const handleOpenPartners = onOpenPartners || onOpenOffers')) {
  throw new Error('Desktop Home must receive onOpenPartners and normalize it to handleOpenPartners with offers fallback.');
}

if (homeSource.includes('(onOpenPartners || onOpenOffers)')) {
  throw new Error('Desktop Home must use handleOpenPartners instead of inline onOpenPartners fallback expressions.');
}

if (!partnersSource.includes('function getCatalogColumns') || !partnersSource.includes('repeat(${gridColumns}, minmax(0, 1fr))') || !partnersSource.includes('style={catalogGridStyle}')) {
  throw new Error('PartnersPage desktop catalog must use an explicit responsive grid, not only DesktopContentGrid auto-fit defaults.');
}

console.log('desktop-partners-page-test: ok');
