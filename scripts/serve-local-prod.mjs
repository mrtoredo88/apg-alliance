import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const root = resolve('dist');
const certDir = resolve('.local-https');
const certPath = join(certDir, 'apg-local.crt');
const keyPath = join(certDir, 'apg-local.key');
const confPath = join(certDir, 'openssl.cnf');
const args = new Set(process.argv.slice(2));
const useHttp = args.has('--http');
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] ?? (useHttp ? 4173 : 4174));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function getLanIps() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}

function ensureCert(ips) {
  if (useHttp) return null;
  mkdirSync(certDir, { recursive: true });
  if (existsSync(certPath) && existsSync(keyPath)) return { cert: readFileSync(certPath), key: readFileSync(keyPath) };

  const altNames = [
    'DNS.1 = localhost',
    'IP.1 = 127.0.0.1',
    ...ips.map((ip, index) => `IP.${index + 2} = ${ip}`),
  ].join('\n');

  writeFileSync(confPath, [
    '[req]',
    'default_bits = 2048',
    'prompt = no',
    'default_md = sha256',
    'distinguished_name = dn',
    'x509_extensions = v3_req',
    '',
    '[dn]',
    'CN = APG Local PWA',
    '',
    '[v3_req]',
    'subjectAltName = @alt_names',
    '',
    '[alt_names]',
    altNames,
    '',
  ].join('\n'));

  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '30',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-config',
    confPath,
  ], { stdio: 'ignore' });

  return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
}

function cacheControl(pathname) {
  if (pathname === '/sw.js' || pathname === '/manifest.json' || pathname === '/version.json' || pathname === '/' || pathname.endsWith('/index.html')) {
    return 'no-store, must-revalidate';
  }
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=300';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://local.apg');
  const pathname = decodeURIComponent(url.pathname);
  let filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (pathname === '/' || pathname.endsWith('/')) filePath = join(root, 'index.html');
  if (!existsSync(filePath)) filePath = join(root, 'index.html');

  const ext = extname(filePath);
  const body = readFileSync(filePath);
  send(res, 200, body, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': cacheControl(pathname),
    'Service-Worker-Allowed': '/',
  });
}

if (!existsSync(join(root, 'index.html'))) {
  console.warn('dist/index.html не найден. Сначала выполните npm run build.');
  process.exit(1);
}

const ips = getLanIps();
const server = useHttp
  ? createHttpServer(handler)
  : createHttpsServer(ensureCert(ips), handler);

server.listen(port, '0.0.0.0', () => {
  const protocol = useHttp ? 'http' : 'https';
  console.log('');
  console.log(`APG local production PWA:`);
  console.log(`  ${protocol}://localhost:${port}/#/`);
  ips.forEach((ip) => console.log(`  ${protocol}://${ip}:${port}/#/`));
  if (!useHttp) {
    console.log('');
    console.log(`iPhone PWA: откройте LAN URL, примите локальный сертификат и добавьте страницу на экран Домой.`);
    console.log(`Сертификат: ${certPath}`);
  }
  console.log('');
});
