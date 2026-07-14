import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const eventsSource = fs.readFileSync(path.join(root, 'src/EventsPage.jsx'), 'utf8');
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
  if (!eventsSource.includes(name)) {
    throw new Error(`EventsPage desktop experience must use ${name}`);
  }
}

if (!eventsSource.includes("from './components/DesktopUI.jsx'")) {
  throw new Error('EventsPage must use the shared Desktop UI Framework.');
}

if (!desktopUiSource.includes('export function DesktopTopOverview') || !desktopUiSource.includes('export function DesktopMetricCard')) {
  throw new Error('Desktop UI Framework must provide DesktopTopOverview and DesktopMetricCard for events composition.');
}

if (desktopUiSource.includes('<DesktopRightRail') || eventsSource.includes('rightRail=')) {
  throw new Error('EventsPage desktop experience must not use a permanent right rail.');
}

if (!eventsSource.includes('desktopMode = false') || !eventsSource.includes("variant === 'v2' && desktopMode")) {
  throw new Error('EventsPage must keep desktop rendering behind the desktopMode flag.');
}

if (!userAppSource.includes('desktopMode={desktopDevice}')) {
  throw new Error('UserApp must pass desktopMode from desktopDevice to EventsPage.');
}

if (!userAppSource.includes('desktopOverview={desktopOverview}')) {
  throw new Error('UserApp must pass the shared DesktopTopOverview data to EventsPage.');
}

if (!eventsSource.includes("variant === 'v2'") || !eventsSource.includes('overflowX')) {
  throw new Error('Mobile EventsPage branch should remain present.');
}

if (!eventsSource.includes('EventDetailSheet')) {
  throw new Error('EventsPage must keep the existing event detail sheet.');
}

console.log('desktop-events-page-test: ok');
