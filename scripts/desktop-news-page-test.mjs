import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const newsSource = fs.readFileSync(path.join(root, 'src/NewsPage.jsx'), 'utf8');
const userAppSource = fs.readFileSync(path.join(root, 'src/UserApp.jsx'), 'utf8');
const desktopUiSource = fs.readFileSync(path.join(root, 'src/components/DesktopUI.jsx'), 'utf8');

const requiredFrameworkComponents = [
  'DesktopSectionShell',
  'DesktopHeader',
  'DesktopToolbar',
  'DesktopKpiStrip',
  'DesktopContentGrid',
  'DesktopTopOverview',
  'DesktopSidebarCard',
  'DesktopActionBar',
  'DesktopEmptyState',
  'DesktopSkeleton',
  'DesktopSectionTitle',
];

for (const name of requiredFrameworkComponents) {
  if (!newsSource.includes(name)) {
    throw new Error(`NewsPage desktop experience must use ${name}`);
  }
}

if (!newsSource.includes("from './components/DesktopUI.jsx'")) {
  throw new Error('NewsPage must use the shared Desktop UI Framework.');
}

if (!desktopUiSource.includes('export function DesktopTopOverview') || !desktopUiSource.includes('export function DesktopMetricCard')) {
  throw new Error('Desktop UI Framework must provide DesktopTopOverview and DesktopMetricCard for NewsPage composition.');
}

if (desktopUiSource.includes('<DesktopRightRail') || newsSource.includes('rightRail=')) {
  throw new Error('NewsPage desktop experience must not use a permanent right rail.');
}

if (!desktopUiSource.includes('<DesktopMetricCard')) {
  throw new Error('DesktopKpiStrip must compose metric cards.');
}

if (!newsSource.includes('desktopMode = false') || !newsSource.includes('if (desktopMode)')) {
  throw new Error('NewsPage must keep desktop rendering behind the desktopMode flag.');
}

if (!newsSource.includes('<DesktopGallery items={photos} onOpen={setLightboxIndex} />')) {
  throw new Error('NewsPage desktop detail mini-gallery must open the clicked photo index.');
}

if (!userAppSource.includes('desktopMode={desktopDevice}')) {
  throw new Error('UserApp must pass desktopMode from desktopDevice to NewsPage.');
}

if (!userAppSource.includes('desktopOverview={desktopOverview}')) {
  throw new Error('UserApp must pass the shared DesktopTopOverview data to NewsPage.');
}

if (!newsSource.includes('data-apg-horizontal-scroll="true"')) {
  throw new Error('Mobile NewsPage branch should remain present and unchanged.');
}

console.log('desktop-news-page-test: ok');
