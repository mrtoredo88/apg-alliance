import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtml = path.join(distDir, 'index.html');

const categoryRules = [
  ['Vendor React', /vendor-react|react|react-dom|scheduler/i],
  ['Vendor Firebase', /vendor-firebase|firebase|firestore|auth/i],
  ['Vendor VKUI', /vkui|vkontakte|useConfigDirection|HorizontalScroll/i],
  ['Vendor Loki', /loki|Loki|ContextEngine|ProactiveEngine|ActionExecutor|DismissManager|Personality|Capability|Evaluation|Execution|Knowledge|ToolRegistry|ToolResult/i],
  ['Vendor Workspace', /Workspace|workspace|CabinetCore/i],
  ['Vendor Markdown', /Markdown|MdEditor|remark|react-markdown/i],
  ['Vendor QR', /qr|Scanner|QRCode/i],
  ['Vendor AWS', /aws|s3|presigner/i],
];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function gzipSize(file) {
  return zlib.gzipSync(fs.readFileSync(file)).length;
}

function classify(name) {
  return categoryRules.find(([, pattern]) => pattern.test(name))?.[0] || 'Other';
}

function kb(value) {
  return Math.round((Number(value || 0) / 1024) * 10) / 10;
}

function assetPath(asset) {
  const clean = asset.replace(/^\/?assets\//, '');
  return path.join(assetsDir, clean);
}

function assetStats(asset) {
  const file = assetPath(asset);
  const raw = fs.existsSync(file) ? fs.statSync(file).size : 0;
  return {
    asset: asset.replace(/^\/?assets\//, ''),
    category: classify(asset),
    rawBytes: raw,
    gzipBytes: raw ? gzipSize(file) : 0,
    parseEstimateMs: Math.round((raw / 1024) * 0.18),
  };
}

function staticImports(asset, seen = new Set()) {
  const clean = asset.replace(/^\/?assets\//, '');
  if (seen.has(clean)) return [];
  seen.add(clean);
  const file = assetPath(clean);
  if (!fs.existsSync(file) || !clean.endsWith('.js')) return [];
  const source = read(file);
  const imports = [...source.matchAll(/from\s*["']\.\/([^"']+)["']/g)].map(match => match[1]);
  return imports.flatMap(item => [item, ...staticImports(item, seen)]);
}

function dynamicImports(asset) {
  const clean = asset.replace(/^\/?assets\//, '');
  const file = assetPath(clean);
  if (!fs.existsSync(file) || !clean.endsWith('.js')) return [];
  const source = read(file);
  return [...source.matchAll(/import\(["']\.\/([^"']+)["']\)/g)].map(match => match[1]);
}

function sum(rows) {
  return rows.reduce((acc, row) => ({
    rawBytes: acc.rawBytes + row.rawBytes,
    gzipBytes: acc.gzipBytes + row.gzipBytes,
    parseEstimateMs: acc.parseEstimateMs + row.parseEstimateMs,
  }), { rawBytes: 0, gzipBytes: 0, parseEstimateMs: 0 });
}

function group(rows) {
  return rows.reduce((acc, row) => {
    const next = acc[row.category] || { rawBytes: 0, gzipBytes: 0, parseEstimateMs: 0, chunks: 0 };
    next.rawBytes += row.rawBytes;
    next.gzipBytes += row.gzipBytes;
    next.parseEstimateMs += row.parseEstimateMs;
    next.chunks += 1;
    acc[row.category] = next;
    return acc;
  }, {});
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  rows.forEach(row => {
    console.log(`${row.asset.padEnd(48)} ${String(kb(row.rawBytes)).padStart(8)} KB raw ${String(kb(row.gzipBytes)).padStart(8)} KB gzip ${String(row.parseEstimateMs).padStart(5)} ms parse ${row.category}`);
  });
}

function run() {
  if (!fs.existsSync(indexHtml)) throw new Error('dist/index.html not found. Run npm run build first.');
  const html = read(indexHtml);
  const entryAssets = [
    ...html.matchAll(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+)"/g),
  ].map(match => match[1]);
  const preloadAssets = [
    ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+)"/g),
  ].map(match => match[1]);
  const cssAssets = [
    ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/assets\/([^"]+)"/g),
  ].map(match => match[1]);
  const htmlInitial = [...new Set([...entryAssets, ...preloadAssets, ...cssAssets, ...entryAssets.flatMap(asset => staticImports(asset))])];
  const entryDynamic = [...new Set(entryAssets.flatMap(asset => dynamicImports(asset)))];
  const startupDynamic = entryDynamic.filter(asset => /^UserApp-.*\.js$/.test(asset));
  const initial = [...new Set([...htmlInitial, ...startupDynamic, ...startupDynamic.flatMap(asset => staticImports(asset))])];
  const dynamic = entryDynamic.filter(asset => !initial.includes(asset));
  const allAssets = fs.readdirSync(assetsDir).filter(file => /\.(js|css)$/.test(file));
  const lazy = allAssets.filter(asset => !initial.includes(asset));

  const initialRows = initial.map(assetStats).sort((a, b) => b.gzipBytes - a.gzipBytes);
  const dynamicRows = dynamic.map(assetStats).sort((a, b) => b.gzipBytes - a.gzipBytes);
  const topRows = allAssets.map(assetStats).sort((a, b) => b.gzipBytes - a.gzipBytes).slice(0, 20);
  const totals = sum(initialRows);
  const grouped = group(initialRows);
  const report = {
    generatedAt: new Date().toISOString(),
    htmlInitial: { chunks: htmlInitial.length, ...Object.fromEntries(Object.entries(sum(htmlInitial.map(assetStats))).map(([key, value]) => [key.replace('Bytes', 'Kb'), key.endsWith('Bytes') ? kb(value) : value])) },
    initial: { chunks: initialRows.length, rawKb: kb(totals.rawBytes), gzipKb: kb(totals.gzipBytes), parseEstimateMs: totals.parseEstimateMs },
    categories: Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, {
      chunks: value.chunks,
      rawKb: kb(value.rawBytes),
      gzipKb: kb(value.gzipBytes),
      parseEstimateMs: value.parseEstimateMs,
    }])),
    initialChunks: initialRows.map(row => ({ ...row, rawKb: kb(row.rawBytes), gzipKb: kb(row.gzipBytes) })),
    lazyChunks: lazy.length,
    dynamicChunks: dynamicRows.map(row => ({ ...row, rawKb: kb(row.rawBytes), gzipKb: kb(row.gzipBytes) })),
    top20: topRows.map(row => ({ ...row, rawKb: kb(row.rawBytes), gzipKb: kb(row.gzipBytes) })),
  };

  console.log(JSON.stringify(report, null, 2));
  printTable('Initial Bundle', initialRows);
  printTable('Dynamic from entry', dynamicRows.slice(0, 20));
  printTable('Top 20 assets', topRows);
}

run();
