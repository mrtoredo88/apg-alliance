import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const partnerPageSource = readFileSync(new URL('../src/PartnerPage.jsx', import.meta.url), 'utf8');
const adminPanelSource = readFileSync(new URL('../src/AdminPanel.jsx', import.meta.url), 'utf8');
const adminActionsSource = readFileSync(new URL('../server/src/routes/admin-actions.js', import.meta.url), 'utf8');

for (const token of [
  'partner.telegramCommunityUrl || partner.telegramUrl',
  'partner.maxCommunityUrl || partner.maxUrl',
  'partner.vkGroupUrl || partner.vkUrl',
  "partnerTelegramUrl && { id: 'telegram'",
  "partnerMaxUrl && { id: 'max'",
  '{partnerTelegramUrl && (',
  '{partnerMaxUrl && (',
  '!isDuplicatePartnerSocial(partner.socialUrl)',
]) {
  assert.ok(partnerPageSource.includes(token), `PartnerPage must preserve public social link fallback: ${token}`);
}

for (const token of [
  "setPTelegramCom(p.telegramCommunityUrl ?? p.telegramUrl ?? '')",
  "setPMaxCom(p.maxCommunityUrl ?? p.maxUrl ?? '')",
  "telegramCommunityUrl: normalizeUrl(pTelegramCom, 'telegram')",
  "telegramUrl: normalizeUrl(pTelegramCom, 'telegram')",
  "maxCommunityUrl: normalizeUrl(pMaxCom, 'max')",
  "maxUrl: normalizeUrl(pMaxCom, 'max')",
  'p.telegramCommunityUrl || p.telegramUrl',
  'p.maxCommunityUrl || p.maxUrl',
]) {
  assert.ok(adminPanelSource.includes(token), `AdminPanel must save and display partner social aliases: ${token}`);
}

for (const token of [
  'partner.telegramCommunityUrl || partner.telegramUrl',
  'partner.maxCommunityUrl || partner.maxUrl',
]) {
  assert.ok(adminActionsSource.includes(token), `Admin readiness must account for partner social aliases: ${token}`);
}

console.log('partner-social-links-test: ok');
