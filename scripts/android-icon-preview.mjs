import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const svg = await fs.readFile(path.join(root, 'resources/android/icon.svg'), 'utf8');
const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const output = path.join(root, 'docs/android/adaptive-icon-preview.png');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 360 }, deviceScaleFactor: 1 });
await page.setContent(`
  <style>
    body{margin:0;background:#eee9df;font-family:Arial,sans-serif;color:#18131d}
    main{height:360px;display:flex;align-items:center;justify-content:center;gap:54px}
    figure{margin:0;text-align:center;font-weight:700}
    img{width:210px;height:210px;display:block;margin-bottom:18px;box-shadow:0 18px 40px #24152b33}
    .pixel img{border-radius:50%}.samsung img{border-radius:30%}.xiaomi img{border-radius:23%}.square img{border-radius:12%}
  </style>
  <main>
    <figure class="pixel"><img src="${data}">Pixel · круг</figure>
    <figure class="samsung"><img src="${data}">Samsung · squircle</figure>
    <figure class="xiaomi"><img src="${data}">Xiaomi · rounded</figure>
    <figure class="square"><img src="${data}">Квадратная маска</figure>
  </main>
`);
await fs.mkdir(path.dirname(output), { recursive: true });
await page.screenshot({ path: output });
await browser.close();
console.log(output);
