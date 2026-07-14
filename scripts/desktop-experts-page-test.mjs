import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expertsSource = fs.readFileSync(path.join(root, 'src/ExpertsPage.jsx'), 'utf8');
const userAppSource = fs.readFileSync(path.join(root, 'src/UserApp.jsx'), 'utf8');
const homeSource = fs.readFileSync(path.join(root, 'src/HomePanelV2.jsx'), 'utf8');

const requiredFrameworkComponents = [
  'DesktopTopOverview',
  'DesktopSectionShell',
  'DesktopHeader',
  'DesktopToolbar',
  'DesktopKpiStrip',
  'DesktopCatalogGrid',
  'DesktopCard',
  'DesktopCardPreview',
  'DesktopActionBar',
  'DesktopMetricCard',
  'DesktopSidebarCard',
  'DesktopEmptyState',
  'DesktopSkeleton',
  'DesktopSectionTitle',
];

for (const name of requiredFrameworkComponents) {
  if (!expertsSource.includes(name)) {
    throw new Error(`ExpertsPage desktop experience must use ${name}`);
  }
}

if (!expertsSource.includes("from './components/DesktopUI.jsx'")) {
  throw new Error('ExpertsPage must use the shared Desktop UI Framework.');
}

if (!expertsSource.includes('desktopMode = false') || !expertsSource.includes('if (desktopMode)')) {
  throw new Error('ExpertsPage desktop rendering must be explicitly gated by desktopMode.');
}

if (!expertsSource.includes('function ExpertCatalogCard') || !expertsSource.includes('function ExpertsMapPreview')) {
  throw new Error('ExpertsPage must provide compact desktop catalog cards and map/split preview.');
}

if (!expertsSource.includes('function getDesktopCatalogColumns') || !expertsSource.includes('if (width >= 1600) return 4') || !expertsSource.includes('if (width >= 1300) return 3') || !expertsSource.includes('if (width >= 1000) return 2')) {
  throw new Error('ExpertsPage desktop catalog must use explicit 4/3/2/1 responsive columns.');
}

if (!expertsSource.includes('<DesktopCatalogGrid') || !expertsSource.includes('<DesktopCard') || !expertsSource.includes('<DesktopCardPreview')) {
  throw new Error('ExpertsPage desktop cards must be assembled from Desktop Catalog Framework components.');
}

const expertCardStart = expertsSource.indexOf('function ExpertCatalogCard');
const expertCardEnd = expertsSource.indexOf('function ExpertsMapPreview');
const expertCardSource = expertsSource.slice(expertCardStart, expertCardEnd);
if (expertCardSource.includes('<GlassCard')) {
  throw new Error('ExpertsPage desktop catalog must not use the old local mobile-like GlassCard layout.');
}

if (!expertCardSource.includes('onMouseEnter={() => onSelect?.(expert)}') || !expertCardSource.includes('onFocus={() => onSelect?.(expert)}')) {
  throw new Error('ExpertsPage desktop cards must update Quick Preview on hover/focus.');
}

if (!expertsSource.includes('DesktopToolbar') || !expertsSource.includes('value={activeCategory}') || !expertsSource.includes('value={availabilityFilter}')) {
  throw new Error('ExpertsPage desktop toolbar must expose category and availability filters.');
}

if (!expertsSource.includes('<ExpertModal') || !expertsSource.includes('onOpen={openExpert}')) {
  throw new Error('ExpertsPage desktop detail must continue using the existing ExpertModal flow.');
}

const requiredDetailComponents = [
  'DesktopDetailShell',
  'DesktopHero',
  'DesktopHeroActions',
  'DesktopInfoGrid',
  'DesktopDetailTabs',
  'DesktopSection',
  'DesktopMeta',
  'DesktopGallery',
  'DesktopSidebarCard',
  'DesktopStickyActions',
];

for (const name of requiredDetailComponents) {
  if (!expertsSource.includes(name)) {
    throw new Error(`Expert desktop detail must use ${name}`);
  }
}

if (!expertsSource.includes('desktopMode = false') || !expertsSource.includes('if (desktopMode)')) {
  throw new Error('Expert desktop detail must be explicitly gated by desktopMode.');
}

if (!expertsSource.includes("hasServices && { id: 'services'") || !expertsSource.includes("expert.offer && { id: 'offer'") || !expertsSource.includes("hasPhotos && { id: 'photos'")) {
  throw new Error('Expert desktop tabs must be built from existing expert data only.');
}

if (!expertsSource.includes('desktopMode={desktopMode}')) {
  throw new Error('ExpertsPage must pass desktopMode into ExpertModal.');
}

if (!userAppSource.includes('<ExpertsPage') || !userAppSource.includes('desktopOverview={desktopOverview}') || !userAppSource.includes('desktopMode={desktopDevice}')) {
  throw new Error('UserApp must pass desktop overview and desktopMode to ExpertsPage.');
}

if (!homeSource.includes('onOpenExperts={onOpenExperts}') || !homeSource.includes("{ label: 'Эксперты', onClick: onOpenExperts }")) {
  throw new Error('Desktop Home must pass onOpenExperts into the top navigation.');
}

console.log('desktop-experts-page-test: ok');
