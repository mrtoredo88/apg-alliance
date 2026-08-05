import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homeSource = fs.readFileSync(path.join(root, 'src/HomePanelV2.jsx'), 'utf8');
const mobileHomeSource = fs.readFileSync(path.join(root, 'src/HomeMobileRedesign.jsx'), 'utf8');
const userAppSource = fs.readFileSync(path.join(root, 'src/UserApp.jsx'), 'utf8');
const desktopSource = fs.readFileSync(path.join(root, 'src/components/DesktopUI.jsx'), 'utf8');

const requiredDesktopProps = [
  'profileToday',
  'profileLatestActivity',
  'profileProgressColor',
  'Личный городской кабинет',
  'Участник АПГ',
];

const missingDesktopProps = requiredDesktopProps.filter(token => !desktopSource.includes(token) && !homeSource.includes(token));
if (missingDesktopProps.length) {
  throw new Error(`Home profile dashboard is missing desktop profile signals: ${missingDesktopProps.join(', ')}`);
}

if (!desktopSource.includes("gridTemplateColumns: '88px minmax(0, 1fr) auto'") || !desktopSource.includes('conic-gradient(${progressColor}')) {
  throw new Error('DesktopTopOverview must render the V3 profile dashboard hero with a real progress-ring avatar.');
}

if (!desktopSource.includes('supportingStats') || !desktopSource.includes('safeStats.slice(0, 4)')) {
  throw new Error('Desktop profile dashboard must separate balance from three supporting KPIs.');
}

if (!desktopSource.includes('balanceStat.value') || !homeSource.includes('sub: keysToNext > 0')) {
  throw new Error('Desktop profile dashboard must promote the real key balance and preserve contextual source data.');
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

if (!homeSource.includes("['Ключи', userKeys") || !homeSource.includes("['Мои события'") || !homeSource.includes("['Избранное', favorites.length")) {
  throw new Error('Mobile home profile dashboard must render keys, personal events and favorites.');
}

const partnerPropOccurrences = homeSource.match(/partners=\{partners\}/g) || [];
if (partnerPropOccurrences.length < 3 || !homeSource.includes('function V2FirstScreenMobile({') || !homeSource.includes('partners = [],')) {
  throw new Error('Partner catalog must be passed through HomePanelV2, V2FirstScreen and V2FirstScreenMobile.');
}

if (!mobileHomeSource.includes('window.setInterval') || !mobileHomeSource.includes('}, 5000)') || !mobileHomeSource.includes('heroSlides.map')) {
  throw new Error('Mobile home hero must automatically rotate slides every five seconds and update its indicators.');
}

if (!mobileHomeSource.includes("appearance = 'light'") || !mobileHomeSource.includes("appearance === 'dark'") || !mobileHomeSource.includes("data-mobile-home-theme={appearance}") || !mobileHomeSource.includes("'--hm-bg': '#101011'")) {
  throw new Error('Mobile home must preserve separate light and dark theme palettes.');
}

if (!userAppSource.includes('title="Места"') || !userAppSource.includes('showAllPartners') || !userAppSource.includes("subtitle={`${enrichedPartners.length} мест в каталоге АПГ`}")) {
  throw new Error('Mobile Places action must open the complete mobile partner catalog.');
}

if (!userAppSource.includes("opacity: active ? 1 : 0.92") || !userAppSource.includes("color: isActive ? '#b47c13' : '#5f5a60', opacity: 1")) {
  throw new Error('Inactive bottom-island icons and labels must remain visible.');
}

console.log('home-profile-dashboard-test: ok');
