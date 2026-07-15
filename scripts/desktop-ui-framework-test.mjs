import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src/components/DesktopUI.jsx');
const source = fs.readFileSync(filePath, 'utf8');
const glassSource = fs.readFileSync(path.join(root, 'src/components/Apg2ProfileGlass.jsx'), 'utf8');
const themeSource = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const workspaceSource = fs.readFileSync(path.join(root, 'src/workspace/DesktopWorkspace.jsx'), 'utf8');

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

if (!source.includes('height: 316') || !source.includes("gridTemplateRows: '78px minmax(0, 1fr)'")) {
  throw new Error('Desktop Catalog Entity Card must enforce fixed height and a stable baseline grid.');
}

if (!source.includes('DesktopDetailShell') || !source.includes('DesktopDetailTabs') || !source.includes('DesktopHeroActions')) {
  throw new Error('Desktop Detail Framework must provide shared shell, tabs and hero actions for partner/expert cards.');
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

console.log('desktop-ui-framework-test: ok');
