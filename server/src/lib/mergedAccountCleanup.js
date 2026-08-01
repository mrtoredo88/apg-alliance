import { createHash, randomBytes } from 'node:crypto';
import { serverFoundation } from '../apg/index.js';

const IMMUTABLE_COLLECTIONS = new Set(['adminActivity', 'adminSecurityLog', 'userMergeSnapshots', 'userPurgeSnapshots']);

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value !== 'string') return structuredClone(value);
  try { return JSON.parse(value); } catch { return {}; }
}

function replaceExact(value, sourceId, targetId, paths = [], path = '') {
  if (value === sourceId) return { value: targetId, changed: true, paths: [...paths, path || '$'] };
  if (Array.isArray(value)) {
    let changed = false;
    const nextPaths = [...paths];
    const next = value.map((item, index) => {
      const result = replaceExact(item, sourceId, targetId, nextPaths, `${path}[${index}]`);
      if (result.changed) changed = true;
      nextPaths.splice(0, nextPaths.length, ...result.paths);
      return result.value;
    });
    return { value: next, changed, paths: nextPaths };
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const nextPaths = [...paths];
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const result = replaceExact(item, sourceId, targetId, nextPaths, childPath);
      next[key] = result.value;
      if (result.changed) changed = true;
      nextPaths.splice(0, nextPaths.length, ...result.paths);
    }
    return { value: next, changed, paths: nextPaths };
  }
  return { value, changed: false, paths };
}

function mergeNested(source, target) {
  if (Array.isArray(source) && Array.isArray(target)) {
    return [...target, ...source.filter(item => !target.some(current => JSON.stringify(current) === JSON.stringify(item)))];
  }
  if (source && target && typeof source === 'object' && typeof target === 'object' && !Array.isArray(source) && !Array.isArray(target)) {
    const merged = { ...source };
    for (const [key, value] of Object.entries(target)) merged[key] = key in source ? mergeNested(source[key], value) : value;
    return merged;
  }
  return target ?? source;
}

function isMergedSource(data = {}) {
  const targetId = clean(data.mergedInto || data.dataMigratedInto || data.canonicalUserId, 260);
  const status = clean(data.accountStatus || data.identityStatus || '', 80).toLowerCase();
  return data.archived === true && Boolean(targetId) && ['merged', 'legacy_linked'].includes(status);
}

function tokenFor(preview) {
  return createHash('sha256').update(JSON.stringify({
    sourceId: preview.sourceId,
    targetId: preview.targetId,
    sourceUpdatedAt: preview.sourceUpdatedAt,
    targetUpdatedAt: preview.targetUpdatedAt,
    references: preview.references.map(item => [item.collection, item.parentPath, item.id, [...item.paths].sort()]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    nested: preview.nested.map(item => [item.collection, item.parentPath, item.id]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  })).digest('hex');
}

async function buildPreviewWithClient(client, sourceId) {
  const sourceResult = await client.query(`SELECT data, updated_at FROM apg_app_documents WHERE collection_name = 'users' AND parent_path = '' AND document_id = $1 LIMIT 1`, [sourceId]);
  const sourceRow = sourceResult.rows[0];
  if (!sourceRow) throw Object.assign(new Error('Архивный аккаунт не найден.'), { statusCode: 404 });
  const source = parseJson(sourceRow.data);
  if (!isMergedSource(source)) throw Object.assign(new Error('Удалять этим способом можно только архивный аккаунт, уже объединённый с основным.'), { statusCode: 409, code: 'NOT_MERGED_ALIAS' });
  let targetId = clean(source.mergedInto || source.dataMigratedInto || source.canonicalUserId, 260);
  if (!targetId || targetId === sourceId) throw Object.assign(new Error('Основной аккаунт для alias не определён.'), { statusCode: 409 });
  let targetRow = null;
  let target = {};
  const chain = [sourceId];
  for (let depth = 0; depth < 12; depth += 1) {
    const targetResult = await client.query(`SELECT data, updated_at FROM apg_app_documents WHERE collection_name = 'users' AND parent_path = '' AND document_id = $1 LIMIT 1`, [targetId]);
    targetRow = targetResult.rows[0];
    target = parseJson(targetRow?.data);
    const nextTarget = clean(target.mergedInto || target.dataMigratedInto || '', 260);
    if (!targetRow || !target.archived || !nextTarget) break;
    if (chain.includes(targetId) || nextTarget === targetId) throw Object.assign(new Error('Обнаружен цикл объединённых аккаунтов.'), { statusCode: 409, code: 'MERGED_ALIAS_CYCLE' });
    chain.push(targetId);
    targetId = nextTarget;
  }
  if (!targetRow || target.archived === true || ['merged', 'deleted'].includes(clean(target.accountStatus, 80).toLowerCase())) {
    throw Object.assign(new Error('Основной аккаунт отсутствует или неактивен.'), { statusCode: 409, code: 'CANONICAL_ACCOUNT_UNAVAILABLE' });
  }

  const candidates = await client.query(`
    SELECT collection_name, parent_path, document_id, data
    FROM apg_app_documents
    WHERE data::text LIKE $1 OR parent_path LIKE $2
  `, [`%${sourceId.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`, `users/${sourceId}/%`]);
  const references = [];
  const nested = [];
  for (const row of candidates.rows) {
    if (row.collection_name === 'users' && row.parent_path === '' && row.document_id === sourceId) continue;
    if (row.parent_path === `users/${sourceId}` || row.parent_path.startsWith(`users/${sourceId}/`)) {
      nested.push({ collection: row.collection_name, parentPath: row.parent_path, id: row.document_id });
      continue;
    }
    const replaced = replaceExact(parseJson(row.data), sourceId, targetId);
    if (!replaced.changed) continue;
    references.push({
      collection: row.collection_name,
      parentPath: row.parent_path,
      id: row.document_id,
      paths: replaced.paths,
      immutable: IMMUTABLE_COLLECTIONS.has(row.collection_name),
    });
  }
  const nestedConflicts = [];
  for (const item of nested) {
    const targetParent = item.parentPath.replace(`users/${sourceId}`, `users/${targetId}`);
    const conflict = await client.query('SELECT 1 FROM apg_app_documents WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3 LIMIT 1', [item.collection, targetParent, item.id]);
    if (conflict.rows[0]) nestedConflicts.push({ ...item, targetParent });
  }
  const preview = {
    sourceId,
    targetId,
    sourceUpdatedAt: sourceRow.updated_at,
    targetUpdatedAt: targetRow.updated_at,
    references,
    movableReferences: references.filter(item => !item.immutable),
    historicalReferences: references.filter(item => item.immutable),
    nested,
    nestedConflicts,
    chain,
    safeToPurge: true,
  };
  return { ...preview, stateToken: tokenFor(preview) };
}

export async function previewMergedAccountCleanup(sourceIds = []) {
  const adapter = serverFoundation.account?.profiles?.adapter;
  if (!adapter?.available) throw Object.assign(new Error('Account Core недоступен.'), { statusCode: 503 });
  const ids = [...new Set(sourceIds.map(id => clean(id, 260)).filter(Boolean))];
  const previews = [];
  for (const sourceId of ids) previews.push(await adapter.transaction(client => buildPreviewWithClient(client, sourceId)));
  return previews;
}

export async function purgeMergedAccount({ sourceId, stateToken, actorId = '', reason = '' } = {}) {
  const adapter = serverFoundation.account?.profiles?.adapter;
  if (!adapter?.available) throw Object.assign(new Error('Account Core недоступен.'), { statusCode: 503 });
  return adapter.transaction(async client => {
    const preview = await buildPreviewWithClient(client, clean(sourceId, 260));
    if (!stateToken || stateToken !== preview.stateToken) throw Object.assign(new Error('Данные изменились после проверки. Выполните preview повторно.'), { statusCode: 409, code: 'PURGE_STATE_CHANGED' });
    const source = await client.query(`SELECT data FROM apg_app_documents WHERE collection_name = 'users' AND parent_path = '' AND document_id = $1 FOR UPDATE`, [preview.sourceId]);
    const snapshotId = `purge_${Date.now().toString(36)}_${randomBytes(5).toString('hex')}`;
    const referenceBackups = [];
    for (const reference of preview.movableReferences) {
      const row = await client.query('SELECT data FROM apg_app_documents WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3 FOR UPDATE', [reference.collection, reference.parentPath, reference.id]);
      if (row.rows[0]) referenceBackups.push({ ...reference, data: parseJson(row.rows[0].data) });
    }
    const nestedBackups = [];
    for (const item of preview.nested) {
      const targetParent = item.parentPath.replace(`users/${preview.sourceId}`, `users/${preview.targetId}`);
      const sourceNested = await client.query('SELECT data FROM apg_app_documents WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3 FOR UPDATE', [item.collection, item.parentPath, item.id]);
      const targetNested = await client.query('SELECT data FROM apg_app_documents WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3 FOR UPDATE', [item.collection, targetParent, item.id]);
      nestedBackups.push({ ...item, targetParent, sourceData: parseJson(sourceNested.rows[0]?.data), targetData: targetNested.rows[0] ? parseJson(targetNested.rows[0].data) : null });
    }
    await client.query(`INSERT INTO apg_app_documents (collection_name, document_id, parent_path, data) VALUES ('userPurgeSnapshots', $1, '', $2::jsonb)`, [snapshotId, JSON.stringify({
      id: snapshotId,
      sourceId: preview.sourceId,
      targetId: preview.targetId,
      source: parseJson(source.rows[0]?.data),
      preview,
      referenceBackups,
      nestedBackups,
      actorId,
      reason,
      createdAt: new Date().toISOString(),
      recoverable: true,
    })]);
    for (const reference of preview.movableReferences) {
      const original = referenceBackups.find(item => item.collection === reference.collection && item.parentPath === reference.parentPath && item.id === reference.id)?.data;
      if (!original) continue;
      const replaced = replaceExact(original, preview.sourceId, preview.targetId);
      if (reference.collection === 'users' && reference.parentPath === '' && reference.id === preview.targetId) {
        if (Array.isArray(original.identityAliases)) replaced.value.identityAliases = original.identityAliases;
        if (Array.isArray(original.linkedAccounts)) replaced.value.linkedAccounts = original.linkedAccounts;
      }
      await client.query('UPDATE apg_app_documents SET data = $4::jsonb, updated_at = now() WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3', [reference.collection, reference.parentPath, reference.id, JSON.stringify(replaced.value)]);
    }
    for (const item of nestedBackups) {
      if (item.targetData) {
        const merged = mergeNested(item.sourceData, item.targetData);
        await client.query('UPDATE apg_app_documents SET data = $4::jsonb, updated_at = now() WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3', [item.collection, item.targetParent, item.id, JSON.stringify(merged)]);
        await client.query('DELETE FROM apg_app_documents WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3', [item.collection, item.parentPath, item.id]);
      } else {
        await client.query('UPDATE apg_app_documents SET parent_path = $4, updated_at = now() WHERE collection_name = $1 AND parent_path = $2 AND document_id = $3', [item.collection, item.parentPath, item.id, item.targetParent]);
      }
    }
    await client.query(`INSERT INTO apg_app_documents (collection_name, document_id, parent_path, data) VALUES ('accountAliases', $1, '', $2::jsonb) ON CONFLICT (collection_name, parent_path, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [preview.sourceId, JSON.stringify({
      id: preview.sourceId,
      canonicalUserId: preview.targetId,
      status: 'redirect',
      source: 'merged-account-purge',
      snapshotId,
      createdAt: new Date().toISOString(),
    })]);
    await client.query(`DELETE FROM apg_app_documents WHERE collection_name = 'users' AND parent_path = '' AND document_id = $1`, [preview.sourceId]);
    return { ok: true, sourceId: preview.sourceId, targetId: preview.targetId, snapshotId, movedReferences: preview.movableReferences.length, movedNested: preview.nested.length, retainedHistoricalReferences: preview.historicalReferences.length };
  });
}
