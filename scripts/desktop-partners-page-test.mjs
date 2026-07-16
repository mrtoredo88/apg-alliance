import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const partnersSource = fs.readFileSync(path.join(root, 'src/PartnersPage.jsx'), 'utf8');
const partnerDetailSource = fs.readFileSync(path.join(root, 'src/PartnerPage.jsx'), 'utf8');
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

if (!homeSource.includes('onOpenPartners,') || !homeSource.includes('const handleOpenPartners = onOpenPartners')) {
  throw new Error('Desktop Home must receive onOpenPartners and route partners through the dedicated handler.');
}

if (homeSource.includes('onOpenPartners || onOpenOffers') || homeSource.includes('(onOpenPartners || onOpenOffers)')) {
  throw new Error('Desktop Home must not fallback Partners navigation to Offers.');
}

if (!homeSource.includes('onOpenPartners={onOpenPartners}')) {
  throw new Error('HomePanelV2 must pass onOpenPartners into the desktop first screen and desktop content.');
}

if (!partnersSource.includes('function getCatalogColumns') || !partnersSource.includes('if (width >= 1600) return 4') || !partnersSource.includes('if (width >= 1300) return 3') || !partnersSource.includes('if (width >= 1000) return 2')) {
  throw new Error('PartnersPage desktop catalog must use explicit 4/3/2/1 responsive columns.');
}

if (!partnersSource.includes('<DesktopCatalogGrid') || !partnersSource.includes('<DesktopCatalogEntityCard')) {
  throw new Error('PartnersPage desktop cards must be assembled from Desktop Catalog Framework components.');
}

if (!partnersSource.includes("const showCatalogRail = viewportWidth >= 1180 && view === 'split'")) {
  throw new Error('PartnersPage must keep Quick Preview out of the default Grid/List catalog.');
}

const partnerCardStart = partnersSource.indexOf('function PartnerCatalogCard');
const partnerCardEnd = partnersSource.indexOf('function PartnersMapPreview');
const partnerCardSource = partnersSource.slice(partnerCardStart, partnerCardEnd);
if (partnerCardSource.includes('<GlassCard')) {
  throw new Error('PartnersPage desktop catalog must not use the old local mobile-like GlassCard layout.');
}

if (!partnerCardSource.includes('media={partner}') || !partnerCardSource.includes('videos={partner?.videos}') || !partnerCardSource.includes('gallery={gallery}')) {
  throw new Error('PartnersPage desktop catalog cards must pass existing profile media into the shared MediaPreview framework.');
}

if (!partnersSource.includes('function partnerCatalogCover') || !partnersSource.includes('partner?.cover') || !partnersSource.includes('partner?.heroImage') || !partnersSource.includes('partner?.coverImage') || !partnersSource.includes('partner?.mainPhoto') || !partnersSource.includes('partner?.photo') || !partnersSource.includes('partner?.logo') || !partnersSource.includes('partner?.videoPreview')) {
  throw new Error('PartnersPage must keep an explicit photo-first catalog cover strategy before video previews.');
}

const coverPrioritySource = partnersSource.slice(partnersSource.indexOf('function partnerCatalogCover'), partnersSource.indexOf('function routeToPartner'));
const coverPriority = ['partner?.cover', 'partner?.heroImage', 'partner?.coverImage', 'partner?.mainPhoto', 'partner?.photo', '\n    gallery,', 'partner?.images', 'partner?.logo', 'partner?.videoPreview'];
for (let index = 1; index < coverPriority.length; index += 1) {
  if (coverPrioritySource.indexOf(coverPriority[index - 1]) > coverPrioritySource.indexOf(coverPriority[index])) {
    throw new Error(`Partner catalog cover priority is wrong: ${coverPriority[index - 1]} must be before ${coverPriority[index]}.`);
  }
}

if (!partnerCardSource.includes('onMouseEnter={() => onSelect?.(partner)}') || !partnerCardSource.includes('onFocus={() => onSelect?.(partner)}')) {
  throw new Error('PartnersPage desktop cards must update Quick Preview on hover/focus.');
}

if (!partnerCardSource.includes("onAskQuestion && { id: 'message'") || partnerCardSource.includes('disabled: !canCall') || partnerCardSource.includes('disabled: !canRoute')) {
  throw new Error('PartnersPage desktop cards must show only available actions and expose contextual dialogs when available.');
}

if (!partnerCardSource.includes('style={compact ? { height: 360 } : undefined}')) {
  throw new Error('PartnersPage compact desktop cards must keep a fixed readable height.');
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
  if (!partnerDetailSource.includes(name)) {
    throw new Error(`PartnerPage desktop detail must use ${name}`);
  }
}

if (!partnerDetailSource.includes('desktopMode = false') || !partnerDetailSource.includes('if (desktopMode)')) {
  throw new Error('PartnerPage desktop detail must be explicitly gated by desktopMode.');
}

if (!partnerDetailSource.includes('buildLivingProfileTabs')
  || !partnerDetailSource.includes('galleryItems')
  || !partnerDetailSource.includes('reviewCount')) {
  throw new Error('PartnerPage must use the shared Living Profile tab model with live counters.');
}

if (partnerDetailSource.includes("{ id: 'important', label: 'Что сейчас важно' }")
  || partnerDetailSource.includes('mode="important"')
  || partnerDetailSource.includes("activeTab === 'important'")) {
  throw new Error('PartnerPage must not render the removed What matters now tab.');
}

if (!partnerDetailSource.includes("activeTab === 'feed'")
  || !partnerDetailSource.includes("activeTab === 'about'")
  || !partnerDetailSource.includes("activeTab === 'offer'")
  || !partnerDetailSource.includes("activeTab === 'photos'")
  || !partnerDetailSource.includes("activeTab === 'video'")
  || !partnerDetailSource.includes("activeTab === 'reviews'")) {
  throw new Error('PartnerPage desktop tabs must follow Living Profile v4 order.');
}

if (!partnerDetailSource.includes("gridTemplateColumns: contactItems.length > 0 ? 'minmax(0, 1.05fr) minmax(280px, 0.95fr)' : '1fr'")
  || !partnerDetailSource.includes('Категории и статусы')
  || !partnerDetailSource.includes('<DesktopMeta items={contactItems} />')) {
  throw new Error('PartnerPage about tab must use the Living Profile v5 desktop card composition.');
}

if (!partnerDetailSource.includes("position: 'relative', minHeight: 220")
  || !partnerDetailSource.includes("filter: 'saturate(1.05) contrast(1.04)'")
  || !partnerDetailSource.includes("background: 'linear-gradient(135deg,#FFF0B8,#D7B86A)'")) {
  throw new Error('PartnerPage offer tab must use the Living Profile v5 covered promo card.');
}

if (!partnerDetailSource.includes('Отзывы помогают другим участникам АПГ')
  || !partnerDetailSource.includes("gridTemplateColumns: 'minmax(180px, 0.36fr) minmax(0, 1fr)'")) {
  throw new Error('PartnerPage reviews tab must include the Living Profile v5 rating summary.');
}

for (const requiredPartnerField of ['partner.bookingUrl', 'partner.socialUrl', 'partner.maxCommunityUrl', 'partner.telegramCommunityUrl', 'stampTarget > 0', "activeTab === 'video'", 'VideoSection videos={partner.videos}']) {
  if (!partnerDetailSource.includes(requiredPartnerField)) {
    throw new Error(`PartnerPage desktop detail must preserve mobile partner field/action: ${requiredPartnerField}`);
  }
}

if (!userAppSource.includes('<PartnerPage') || !userAppSource.includes('desktopMode={desktopDevice}')) {
  throw new Error('UserApp must pass desktopMode into PartnerPage detail.');
}

console.log('desktop-partners-page-test: ok');
