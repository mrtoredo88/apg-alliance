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
  'DesktopCatalogEntityCard',
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

if (!expertsSource.includes('<DesktopCatalogGrid') || !expertsSource.includes('<DesktopCatalogEntityCard')) {
  throw new Error('ExpertsPage desktop cards must be assembled from Desktop Catalog Framework components.');
}

if (!expertsSource.includes("const showCatalogRail = viewportWidth >= 1180 && viewMode === 'split'")) {
  throw new Error('ExpertsPage must keep Quick Preview out of the default Grid/List catalog.');
}

const expertCardStart = expertsSource.indexOf('function ExpertCatalogCard');
const expertCardEnd = expertsSource.indexOf('function ExpertsMapPreview');
const expertCardSource = expertsSource.slice(expertCardStart, expertCardEnd);
if (expertCardSource.includes('<GlassCard')) {
  throw new Error('ExpertsPage desktop catalog must not use the old local mobile-like GlassCard layout.');
}

if (!expertCardSource.includes('media={expert}') || !expertCardSource.includes('videos={expert.videos}') || !expertCardSource.includes('gallery={gallery}')) {
  throw new Error('ExpertsPage desktop catalog cards must pass existing profile media into the shared MediaPreview framework.');
}

if (!expertCardSource.includes('onMouseEnter={() => onSelect?.(expert)}') || !expertCardSource.includes('onFocus={() => onSelect?.(expert)}')) {
  throw new Error('ExpertsPage desktop cards must update Quick Preview on hover/focus.');
}

if (!expertCardSource.includes("onAskQuestion && { id: 'message'") || expertCardSource.includes('disabled: !canBookExpert') || expertCardSource.includes('disabled: !canCall')) {
  throw new Error('ExpertsPage desktop cards must show only available actions and expose contextual dialogs when available.');
}

if (!expertCardSource.includes('style={compact ? { height: 360 } : undefined}')) {
  throw new Error('ExpertsPage compact desktop cards must keep a fixed readable height.');
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

if (!expertsSource.includes('buildLivingProfileTabs')
  || !expertsSource.includes('galleryItems')
  || !expertsSource.includes('expert.reviewCount ?? reviews.length')) {
  throw new Error('Expert detail must use the shared Living Profile tab model with live counters.');
}

if (expertsSource.includes("{ id: 'important', label: 'Что сейчас важно' }")
  || expertsSource.includes('mode="important"')
  || expertsSource.includes("activeTab === 'important'")) {
  throw new Error('Expert detail must not render the removed What matters now tab.');
}

if (!expertsSource.includes("activeTab === 'feed'")
  || !expertsSource.includes("activeTab === 'about'")
  || !expertsSource.includes("activeTab === 'offer'")
  || !expertsSource.includes("activeTab === 'photos'")
  || !expertsSource.includes("activeTab === 'video'")
  || !expertsSource.includes("activeTab === 'reviews'")) {
  throw new Error('Expert desktop tabs must follow Living Profile v4 order.');
}

for (const requiredExpertField of ['expert.bookingUrl', 'expert.whatsappUrl', 'expert.maxUrl', 'expert.serviceCost', "activeTab === 'video'", 'VideoSection videos={expert.videos}']) {
  if (!expertsSource.includes(requiredExpertField)) {
    throw new Error(`Expert desktop detail must preserve mobile expert field/action: ${requiredExpertField}`);
  }
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
