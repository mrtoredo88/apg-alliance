import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src/components/DesktopUI.jsx');
const source = fs.readFileSync(filePath, 'utf8');
const glassSource = fs.readFileSync(path.join(root, 'src/components/Apg2ProfileGlass.jsx'), 'utf8');
const themeSource = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const workspaceSource = fs.readFileSync(path.join(root, 'src/workspace/DesktopWorkspace.jsx'), 'utf8');
const homeSource = fs.readFileSync(path.join(root, 'src/HomePanelV2.jsx'), 'utf8');

const requiredExports = [
  'DesktopSectionShell',
  'DesktopHeader',
  'DesktopToolbar',
  'DesktopKpiStrip',
  'DesktopContentGrid',
  'DesktopTopOverview',
  'DesktopSidebarCard',
  'DesktopMetricCard',
  'DesktopEmptyState',
  'DesktopSkeleton',
  'DesktopActionBar',
  'DesktopSectionTitle',
  'DesktopCatalogGrid',
  'DesktopCatalogEntityCard',
  'DesktopCard',
  'DesktopCardHeader',
  'DesktopCardMeta',
  'DesktopCardTags',
  'DesktopCardActions',
  'DesktopCardFooter',
  'DesktopCardBadges',
  'DesktopCardPreview',
  'DesktopCardHover',
  'MediaPreview',
  'DesktopDetailShell',
  'DesktopHero',
  'DesktopHeroInfo',
  'DesktopHeroActions',
  'DesktopInfoGrid',
  'DesktopMeta',
  'DesktopGallery',
  'DesktopSection',
  'DesktopRelated',
  'DesktopStickyActions',
  'DesktopDetailTabs',
];

const requiredSections = ['news', 'events', 'partners', 'experts', 'offers', 'rewards'];
const workspacePrimitives = ['WorkspaceHeader', 'WorkspacePanel', 'ContentGrid', 'MetricCard', 'QuickActions', 'SectionHeader'];

const missingExports = requiredExports.filter(name => !new RegExp(`export function ${name}\\b`).test(source));
if (missingExports.length) {
  throw new Error(`Desktop UI framework is missing exports: ${missingExports.join(', ')}`);
}

const missingSections = requiredSections.filter(id => !source.includes(`'${id}'`));
if (missingSections.length) {
  throw new Error(`Desktop UI public section registry is incomplete: ${missingSections.join(', ')}`);
}

const missingWorkspaceReuse = workspacePrimitives.filter(name => !source.includes(name));
if (missingWorkspaceReuse.length) {
  throw new Error(`Desktop UI framework does not reuse workspace primitives: ${missingWorkspaceReuse.join(', ')}`);
}

if (!source.includes('../workspace/WorkspaceComponents.jsx')) {
  throw new Error('Desktop UI framework must reuse WorkspaceComponents instead of copying them.');
}

if (source.includes('<DesktopRightRail')) {
  throw new Error('DesktopSectionShell must not compose a permanent right rail.');
}

if (!source.includes('onMouseEnter') || !source.includes('translateY(-3px)') || !source.includes('DesktopCardPreview')) {
  throw new Error('Desktop Catalog Framework must include desktop hover behavior and preview composition.');
}

if (!source.includes('height: 388') || !source.includes("gridTemplateRows: '112px minmax(0, 1fr)'")) {
  throw new Error('Desktop Catalog Entity Card must enforce full-size fixed height and a stable desktop grid.');
}

if (!source.includes('import { parseVideoUrl }') || !source.includes('export function MediaPreview')) {
  throw new Error('Desktop UI Framework must expose a shared Smart Media Preview with existing video parsing.');
}

if (!source.includes('<MediaPreview') || !source.includes('videos={videos}') || !source.includes('gallery={gallery}')) {
  throw new Error('Desktop Catalog Entity Card must render media through the shared MediaPreview framework.');
}

if (!source.includes('mediaPriority="photo-first"')) {
  throw new Error('Desktop Catalog Entity Card must use photo-first media priority so video previews cannot replace catalog covers.');
}

if (!source.includes("mediaPriority = 'video-first'") || !source.includes("mediaPriority === 'photo-first'")) {
  throw new Error('MediaPreview must keep default video-first behavior while supporting photo-first catalog cards.');
}

if (!source.includes('MEDIA_PREVIEW_LIVE_EVENT') || !source.includes('setTimeout') || !source.includes('}, 350)')) {
  throw new Error('MediaPreview must protect desktop live preview with a shared single-preview hover delay.');
}

if (!source.includes('preload="none"') || !source.includes('playsInline') || !source.includes('muted') || !source.includes('loop')) {
  throw new Error('MediaPreview must not preload catalog video and must use muted inline preview only after hover.');
}

if (!source.includes("matchMedia?.('(hover: hover) and (pointer: fine)'") || !source.includes('connection?.saveData') || !source.includes('hardwareConcurrency')) {
  throw new Error('MediaPreview live preview must be disabled on mobile/tablet, data saver and low-performance devices.');
}

if (!source.includes("marginTop: 'auto'") || !source.includes('WebkitLineClamp') || !source.includes('filter(action => !action?.disabled).slice(0, 3)')) {
  throw new Error('Desktop Catalog Entity Card must clamp text, keep actions visible, and hide unavailable buttons.');
}

if (!source.includes('DesktopDetailShell') || !source.includes('DesktopDetailTabs') || !source.includes('DesktopHeroActions')) {
  throw new Error('Desktop Detail Framework must provide shared shell, tabs and hero actions for partner/expert cards.');
}
if (!source.includes("gridTemplateColumns: '138px minmax(0, 1fr) minmax(280px, 0.76fr)'")
  || !source.includes("minHeight: 276")
  || !source.includes("filter: 'saturate(1.04) contrast(1.02)'")) {
  throw new Error('DesktopHero must use the compact cinematic Living Profile v5 composition.');
}
if (!source.includes('window.addEventListener(\'keydown\', handleKeyDown)') || !source.includes("event.key !== 'Escape'")) {
  throw new Error('Desktop Detail Framework must close through the shared Escape keyboard handler.');
}
if (!source.includes('role="dialog"') || !source.includes('aria-modal="true"') || !source.includes("position: 'sticky'")) {
  throw new Error('Desktop Detail Framework must provide dialog semantics and a sticky detail header.');
}
if (!source.includes('role="tablist"') || !source.includes('role="tab"') || !source.includes("event.key === 'ArrowRight'") || !source.includes("event.key === 'Home'")) {
  throw new Error('Desktop Detail tabs must support shared keyboard navigation.');
}
if (!source.includes('onOpenMessages') || !source.includes('messageUnreadCount') || !source.includes('aria-label="Люди"')) {
  throw new Error('DesktopTopOverview must expose People/Messages in the desktop header with unread badge support.');
}

const desktopFirstScreenStart = homeSource.indexOf('function V2FirstScreenDesktop');
const desktopFirstScreenBodyStart = homeSource.indexOf('}) {', desktopFirstScreenStart);
const desktopFirstScreenProps = homeSource.slice(desktopFirstScreenStart, desktopFirstScreenBodyStart);
if (!desktopFirstScreenProps.includes('onOpenMessages')) {
  throw new Error('V2FirstScreenDesktop must receive onOpenMessages before passing it to DesktopTopOverview.');
}

if (!source.includes("top: 'calc(70px + var(--safe-top, 0px))'")
  || !source.includes("bottom: 3")
  || !source.includes("transition: motionTransition(['background', 'border-color', 'color'], 'base')")) {
  throw new Error('Desktop Detail tabs must use the stronger sticky Living Profile v5 indicator.');
}
if (!source.includes('aria-label={`Открыть фото ${index + 1}`}') || !source.includes("typeof item === 'string' ? { url: item")) {
  throw new Error('Desktop Gallery must expose accessible photo controls and support normalized media items.');
}

const darkThemeMatch = themeSource.match(/\[data-theme="dark"\]\s*{([\s\S]*?)\n}/);
if (!darkThemeMatch) {
  throw new Error('Theme CSS must define a dark theme block.');
}
if (darkThemeMatch[1].includes('--apg2-glass-a:    255,255,255')) {
  throw new Error('Dark theme must not use a white APG2 glass base.');
}
if (!darkThemeMatch[1].includes('--apg2-glass-a:    28,28,28')) {
  throw new Error('Dark theme must define the dark APG2 glass base used by Desktop UI cards.');
}
if (!darkThemeMatch[1].includes('--apg2-control:')) {
  throw new Error('Dark theme must define public APG2 control tokens.');
}
if (!darkThemeMatch[1].includes('--apg2-panel-strong:')) {
  throw new Error('Dark theme must define public APG2 panel tokens.');
}
if (!darkThemeMatch[1].includes('--apg-workspace-panel-accent:')) {
  throw new Error('Dark theme must define workspace panel accent tokens.');
}
if (!darkThemeMatch[1].includes('--apg-workspace-control-strong:')) {
  throw new Error('Dark theme must define workspace control tokens.');
}

if (!glassSource.includes('safeStyle') || !glassSource.includes('value !== undefined')) {
  throw new Error('GlassCard must ignore undefined local style values so buttons do not fall back to browser light backgrounds.');
}

['WS.panelAccent', 'WS.panelSoft', 'WS.controlStrong', 'WS.profileCard', 'WS.track'].forEach(token => {
  if (!workspaceSource.includes(token)) {
    throw new Error(`DesktopWorkspace must render theme-aware workspace surface token: ${token}`);
  }
});

['--apg2-control', '--apg2-control-soft', '--apg2-control-strong'].forEach(token => {
  if (!homeSource.includes(token) && !source.includes(token)) {
    throw new Error(`Public Desktop must render theme-aware APG2 token: ${token}`);
  }
});
if (source.includes("background: 'rgba(255,255,255,0.92)'")) {
  throw new Error('Desktop Catalog rating badges must not use fixed light backgrounds.');
}
if (!glassSource.includes("interactiveAs = 'button'") || !source.includes('interactiveAs="div"')) {
  throw new Error('Desktop catalog cards with nested actions must render interactive cards as div, not nested buttons.');
}

console.log('desktop-ui-framework-test: ok');
