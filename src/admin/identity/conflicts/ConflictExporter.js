import fs from 'node:fs';
import path from 'node:path';

export const IDENTITY_BACKUP_DIR = 'backups/identity';
export const RESOLUTION_MANIFEST_PATH = path.join(IDENTITY_BACKUP_DIR, 'resolution-manifest.json');

export function ensureBackupDir(dir = IDENTITY_BACKUP_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function latestFile(prefix, suffix = '.json', dir = IDENTITY_BACKUP_DIR) {
  ensureBackupDir(dir);
  const files = fs.readdirSync(dir).filter(file => file.startsWith(prefix) && file.endsWith(suffix)).sort();
  return files.length ? path.join(dir, files.at(-1)) : '';
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  ensureBackupDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function backupBeforeManifest({ sourceReportPath = '', sourceSnapshotPath = '', manifestPath = RESOLUTION_MANIFEST_PATH } = {}) {
  ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceReportPath,
    sourceSnapshotPath,
    manifestPath,
    readOnly: true,
  };
  const backupPath = path.join(IDENTITY_BACKUP_DIR, `resolution-manifest-backup-${stamp}.json`);
  writeJson(backupPath, backup);
  return backupPath;
}
