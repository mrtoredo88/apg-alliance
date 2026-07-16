import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homeSource = fs.readFileSync(path.join(root, 'src/HomePanelV2.jsx'), 'utf8');
const desktopSource = fs.readFileSync(path.join(root, 'src/components/DesktopUI.jsx'), 'utf8');

const requiredDesktopProps = [
  'profileToday',
  'profileLatestActivity',
  'profileProgressColor',
  'Личный городской кабинет',
  'Сегодня для вас:',
];

const missingDesktopProps = requiredDesktopProps.filter(token => !desktopSource.includes(token) && !homeSource.includes(token));
if (missingDesktopProps.length) {
  throw new Error(`Home profile dashboard is missing desktop profile signals: ${missingDesktopProps.join(', ')}`);
}

if (!desktopSource.includes("gridTemplateColumns: '72px minmax(0, 1fr) auto'") || !desktopSource.includes('conic-gradient(${progressColor}')) {
  throw new Error('DesktopTopOverview must render the V3 profile dashboard hero with a real progress-ring avatar.');
}

if (!desktopSource.includes('primaryStats') || !desktopSource.includes('safeStats.slice(0, 4)')) {
  throw new Error('Desktop profile dashboard must promote a compact four-KPI strip.');
}

if (!desktopSource.includes('stat.sub') || !homeSource.includes('sub: keysToNext > 0')) {
  throw new Error('Desktop profile dashboard KPIs must include short contextual hints from existing data.');
}

if (!homeSource.includes('eventsTodayCount') || !homeSource.includes('todayForYou')) {
  throw new Error('Home profile dashboard must compute the compact Today-for-you insight from existing data.');
}

if (!homeSource.includes('latestActivity') || !homeSource.includes('profileLatestActivity={latestActivity}')) {
  throw new Error('Home profile dashboard must expose latest available activity without new data sources.');
}

if (!homeSource.includes("progressTitle={nextAchievement?.title || (nextLevel ? `До уровня ${nextLevel.label}` : 'Максимальный уровень')}")) {
  throw new Error('Desktop profile dashboard must safely handle users without a next level.');
}

if (!homeSource.includes("['Ключи', userKeys") || !homeSource.includes("['Партнёры', scannedCount")) {
  throw new Error('Mobile home profile dashboard must render the same core KPI set.');
}

console.log('home-profile-dashboard-test: ok');
