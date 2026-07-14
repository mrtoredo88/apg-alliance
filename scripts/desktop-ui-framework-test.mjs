import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src/components/DesktopUI.jsx');
const source = fs.readFileSync(filePath, 'utf8');

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

if (!source.includes('DesktopDetailShell') || !source.includes('DesktopDetailTabs') || !source.includes('DesktopHeroActions')) {
  throw new Error('Desktop Detail Framework must provide shared shell, tabs and hero actions for partner/expert cards.');
}

console.log('desktop-ui-framework-test: ok');
