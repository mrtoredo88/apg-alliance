import fs from 'node:fs';

const required = [
  'server/src/apg/account/schema/account-core.sql',
  'server/src/apg/account/bootstrap/createAccountCore.js',
  'server/src/apg/account/services/AccountCoreService.js',
  'server/src/apg/account/repositories/ProfileRepository.js',
  'server/src/apg/account/repositories/RoleRepository.js',
  'server/src/apg/account/repositories/SessionRepository.js',
  'server/src/apg/account/repositories/CabinetRepository.js',
  'server/src/apg/account/repositories/TelegramSupportRepository.js',
];

const missing = required.filter(file => !fs.existsSync(file));
const report = {
  ok: missing.length === 0,
  mode: 'local_read_only_account_dry_run',
  accountBootstrapEndpoint: fs.existsSync('server/src/routes/account.js'),
  frontendCanaryClient: fs.existsSync('src/accountApi.js'),
  importStarted: false,
  canaryStarted: false,
  cutoverStarted: false,
  productionChanged: false,
  missing,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
