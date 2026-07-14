import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expertsSource = fs.readFileSync(path.join(root, 'src/ExpertsPage.jsx'), 'utf8');
const userAppSource = fs.readFileSync(path.join(root, 'src/UserApp.jsx'), 'utf8');

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

if (!expertsSource.includes('function getDesktopCatalogColumns') || !expertsSource.includes('repeat(${desktopColumns}, minmax(0, 1fr))') || !expertsSource.includes('style={desktopGridStyle}')) {
  throw new Error('ExpertsPage desktop catalog must use an explicit responsive grid.');
}

if (!expertsSource.includes('DesktopToolbar') || !expertsSource.includes('value={activeCategory}') || !expertsSource.includes('value={availabilityFilter}')) {
  throw new Error('ExpertsPage desktop toolbar must expose category and availability filters.');
}

if (!expertsSource.includes('<ExpertModal') || !expertsSource.includes('onOpen={openExpert}')) {
  throw new Error('ExpertsPage desktop detail must continue using the existing ExpertModal flow.');
}

if (!userAppSource.includes('<ExpertsPage') || !userAppSource.includes('desktopOverview={desktopOverview}') || !userAppSource.includes('desktopMode={desktopDevice}')) {
  throw new Error('UserApp must pass desktop overview and desktopMode to ExpertsPage.');
}

console.log('desktop-experts-page-test: ok');
