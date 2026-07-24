import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const res = path.join(root, 'android/app/src/main/res');
const sourceDir = path.join(root, 'resources/android');
const browser = await chromium.launch({ headless: true });

async function renderSvg(source, output, width, height, omitBackground = false) {
  const svg = await fs.readFile(path.join(sourceDir, source), 'utf8');
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{width:100%;height:100%;display:block}</style>${svg}`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output, omitBackground });
  await page.close();
}

const densities = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

for (const [density, size] of Object.entries(densities)) {
  const folder = path.join(res, `mipmap-${density}`);
  await renderSvg('icon.svg', path.join(folder, 'ic_launcher.png'), size, size);
  await renderSvg('icon.svg', path.join(folder, 'ic_launcher_round.png'), size, size);
  await renderSvg('icon-foreground.svg', path.join(folder, 'ic_launcher_foreground.png'), Math.round(size * 2.25), Math.round(size * 2.25), true);
}

const splashSizes = {
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [960, 1600],
  'drawable-port-xxxhdpi': [1280, 1920],
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1600, 960],
  'drawable-land-xxxhdpi': [1920, 1280],
  drawable: [480, 800],
};

for (const [folder, [width, height]] of Object.entries(splashSizes)) {
  await renderSvg('splash.svg', path.join(res, folder, 'splash.png'), width, height);
}

await browser.close();
console.log('Android icon and splash resources generated.');
