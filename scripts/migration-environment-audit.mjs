import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadMigrationEnv, secretStatus } from './lib/migration-env-loader.mjs';

const ROOT = process.cwd();
const REPORT_PATH = 'backups/account-core/preflight/environment-audit-redacted.json';

const REQUIRED_FOR_PREFLIGHT = [
  'APG_IDENTITY_DATABASE_URL',
  'IDENTITY_DATABASE_URL',
  'POSTGRES_DATABASE_URL',
  'DATABASE_URL',
  'FIREBASE_SERVICE_ACCOUNT',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'APG_MIGRATION_ENCRYPTION_KEY',
  'MIGRATION_ENCRYPTION_KEY',
  'APG_BACKUP_PATH',
  'BACKUP_PATH',
  'APG_MONITORING_TOKEN',
  'MONITORING_TOKEN',
  'YC_TOKEN',
  'YANDEX_TOKEN',
];

const KNOWN_SECRET_KEYS = [
  ...REQUIRED_FOR_PREFLIGHT,
  'WEB_PUSH_VAPID_PUBLIC_KEY',
  'WEB_PUSH_VAPID_PRIVATE_KEY',
  'WEB_PUSH_VAPID_SUBJECT',
  'POSTBOX_KEY_ID',
  'POSTBOX_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'CRON_SECRET',
  'PUSH_SECRET',
  'RAFFLE_SECRET',
  'ACTIVITY_SECRET',
  'YC_ACCESS_KEY',
  'YC_SECRET_KEY',
  'VK_SERVICE_TOKEN',
  'VK_USER_TOKEN',
  'VK_GROUP_TOKEN',
  'MINI_APPS_ACCESS_TOKEN',
  'VERCEL_OIDC_TOKEN',
  'IDENTITY_MIGRATION_SECRET',
  'ACCOUNT_CANARY_ALLOWLIST',
];

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function read(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

function envKeysFromFile(file) {
  const text = read(file);
  if (!text) return [];
  return text.split(/\r?\n/)
    .map(line => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean)
    .sort();
}

function command(args) {
  try {
    return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function commandOk(args) {
  return spawnSync(args[0], args.slice(1), { stdio: 'ignore' }).status === 0;
}

function scanEnvUsage() {
  const output = command(['rg', '-n', 'process\\.env|import\\.meta\\.env|dotenv|EnvironmentFile|--environment|secret|Lockbox|lockbox|vault|KMS|kms', '.', '--glob', '!node_modules/**', '--glob', '!dist/**', '--glob', '!backups/**', '--glob', '!*.png']);
  return output.split('\n').filter(Boolean).map(line => {
    const [file, lineNumber] = line.split(':');
    return { file, line: Number(lineNumber || 0), type: 'environment_reference' };
  }).slice(0, 500);
}

function scanSecurityFiles() {
  const targets = [
    'src/AdminPanel.jsx',
    'scripts/bootstrap-owner.mjs',
    'public/vk-auth.html',
    'server/src/routes/admin-security.js',
    'api/qr-token.js',
    'server/src/routes/qr-token.js',
  ];
  const riskPatterns = [
    ['hardcoded_secret_literal', /(secret|token|password|private[_-]?key|api[_-]?key|dsn)\s*[:=]\s*['"][^'"]{6,}/i, 'HIGH'],
    ['hardcoded_owner_identifier', /(owner|admin).{0,40}['"][^'"]+@[^'"]+['"]/i, 'MEDIUM'],
    ['temporary_bypass_or_backdoor', /(bypass|backdoor|temporary|todo|fixme|debug)/i, 'MEDIUM'],
    ['firebase_config_literal', /(apiKey|authDomain|projectId|storageBucket)\s*:/i, 'LOW'],
    ['test_credential_marker', /(test.*password|password.*test|demo.*secret|local.*secret)/i, 'MEDIUM'],
  ];
  const findings = [];
  for (const file of targets) {
    const lines = read(file).split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const [type, pattern, severity] of riskPatterns) {
        if (pattern.test(line)) findings.push({ file, line: index + 1, type, severity });
      }
    });
  }
  return findings;
}

function gitHistoryRisk() {
  const script = `
patterns='firebase-service-account.json|service-account.*\\\\.json|(^|/)\\\\.env($|\\\\.)|server/\\\\.env|account-core-snapshot-.*\\\\.json|firestore-.*snapshot.*\\\\.json'
git log --all --name-only --pretty=format:'COMMIT %H' -- 2>/dev/null | awk '
  /^COMMIT / { c=substr($2,1,12); next }
  $0 ~ /node_modules\\// || $0 ~ /dist\\// || $0 ~ /backups\\// { next }
  $0 ~ /firebase-service-account\\.json|service-account.*\\.json/ { print c "\\tfirebase_service_account_file\\t" $0; next }
  $0 ~ /(^|\\/)\\.env($|\\.)|server\\/\\.env/ { print c "\\tenv_file\\t" $0; next }
  $0 ~ /account-core-snapshot-.*\\.json|firestore-.*snapshot.*\\.json/ { print c "\\tsnapshot_file\\t" $0; next }
'
`;
  const output = command(['bash', '-lc', script]);
  return output.split('\n').filter(Boolean).map(line => {
    const [commit, risk, file] = line.split('\t');
    return { commit, risk, file };
  });
}

const envLoad = loadMigrationEnv();
const envFiles = ['server/.env', '.env.local', '.env.deploy.local', 'server/.env.example'];
const sourceKeys = Object.fromEntries(envFiles.map(file => [file, envKeysFromFile(file)]));
const statuses = secretStatus(KNOWN_SECRET_KEYS, envLoad.sources);
const preflightGroups = {
  postgres: ['APG_IDENTITY_DATABASE_URL', 'IDENTITY_DATABASE_URL', 'POSTGRES_DATABASE_URL', 'DATABASE_URL'].some(key => process.env[key]) ? 'FOUND' : 'MISSING',
  firebaseAdmin: ['FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS'].some(key => process.env[key]) ? 'FOUND' : 'MISSING',
  encryption: ['APG_MIGRATION_ENCRYPTION_KEY', 'MIGRATION_ENCRYPTION_KEY'].some(key => process.env[key]) ? 'FOUND' : 'MISSING',
  backupPath: ['APG_BACKUP_PATH', 'BACKUP_PATH'].some(key => process.env[key]) ? 'FOUND' : 'MISSING',
  monitoring: ['APG_MONITORING_TOKEN', 'MONITORING_TOKEN', 'YC_TOKEN', 'YANDEX_TOKEN'].some(key => process.env[key]) ? 'FOUND' : 'MISSING',
};

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  branch: command(['git', 'branch', '--show-current']),
  commit: command(['git', 'rev-parse', '--short', 'HEAD']),
  productionChanged: false,
  deployStarted: false,
  snapshotStarted: false,
  importStarted: false,
  verifyStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
  secretsPrinted: false,
  environmentLoad: {
    sourceOrder: envLoad.files,
    loadedKeys: envLoad.loaded.map(item => item.key).sort(),
    missingFiles: envLoad.missing,
    redacted: true,
  },
  sourceKeys,
  statuses,
  preflightGroups,
  envUsage: scanEnvUsage(),
  securityReview: scanSecurityFiles(),
  gitHistoryRisk: gitHistoryRisk(),
  gitignore: {
    envIgnored: commandOk(['git', 'check-ignore', '-q', '.env.local']),
    serverEnvIgnored: commandOk(['git', 'check-ignore', '-q', 'server/.env']),
    serviceAccountIgnored: commandOk(['git', 'check-ignore', '-q', 'server/firebase-service-account.json']),
    rawSnapshotDirIgnored: commandOk(['git', 'check-ignore', '-q', 'backups/account-core/snapshot/raw/example.json']),
    encryptedSnapshotIgnored: commandOk(['git', 'check-ignore', '-q', 'backups/account-core/snapshot/example.enc']),
    plainSnapshotJsonIgnored: commandOk(['git', 'check-ignore', '-q', 'backups/account-core/snapshot/account-core-snapshot-test.json']),
  },
};

ensureDir(REPORT_PATH);
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  ok: true,
  report: REPORT_PATH,
  preflightGroups,
  loadedKeyCount: report.environmentLoad.loadedKeys.length,
  securityFindings: report.securityReview.length,
  gitHistoryRisks: report.gitHistoryRisk.length,
  secretsPrinted: false,
}, null, 2));
