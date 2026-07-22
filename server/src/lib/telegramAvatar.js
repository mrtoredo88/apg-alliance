import { putPublicObject } from './objectStorage.js';

const TELEGRAM_TIMEOUT_MS = 6000;
const MAX_AVATAR_BYTES = 8 * 1024 * 1024;

async function telegramJson(method, params = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram bot token is not configured');
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}?${query}`, {
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`Telegram ${method} failed`);
  return payload.result;
}

async function resolveTelegramAvatarFileId(telegramId) {
  const photos = await telegramJson('getUserProfilePhotos', { user_id: telegramId, limit: 1 });
  const sizes = photos?.photos?.[0] || [];
  if (sizes.length) return sizes[sizes.length - 1]?.file_id || '';
  const chat = await telegramJson('getChat', { chat_id: telegramId });
  return chat?.photo?.big_file_id || '';
}

function avatarContentType(response, filePath) {
  const received = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].includes(received)) return received;
  if (/\.png$/i.test(filePath)) return 'image/png';
  if (/\.webp$/i.test(filePath)) return 'image/webp';
  return 'image/jpeg';
}

function avatarExtension(contentType) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

export function normalizeTelegramId(value) {
  return String(value || '').trim().replace(/^tg_/, '');
}

export async function fetchAndStoreTelegramAvatar(telegramId, ownerUserId = '') {
  const normalizedTelegramId = normalizeTelegramId(telegramId);
  if (!/^\d+$/.test(normalizedTelegramId)) return null;
  const fileId = await resolveTelegramAvatarFileId(normalizedTelegramId);
  if (!fileId) return null;
  const file = await telegramJson('getFile', { file_id: fileId });
  if (!file?.file_path) return null;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('Telegram avatar download failed');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) throw new Error('Telegram avatar has invalid size');
  const contentType = avatarContentType(response, file.file_path);
  const safeOwner = String(ownerUserId || `tg_${normalizedTelegramId}`).replace(/[^a-z0-9_-]/gi, '_').slice(0, 180);
  const key = `telegram-avatars/${safeOwner}_${normalizedTelegramId}_${Date.now()}.${avatarExtension(contentType)}`;
  return putPublicObject(key, buffer, contentType);
}
