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
  'DesktopRightRail',
  'DesktopSidebarCard',
  'DesktopMetricCard',
  'DesktopEmptyState',
  'DesktopSkeleton',
  'DesktopActionBar',
  'DesktopSectionTitle',
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

console.log('desktop-ui-framework-test: ok');
