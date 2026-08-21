import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const TIMEOUT_MS = 12000;
let ses;

const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);

function getSes() {
  if (!ses) {
    ses = new SESv2Client({
      endpoint: 'https://postbox.cloud.yandex.net',
      region: 'ru-central1',
      credentials: { accessKeyId: process.env.POSTBOX_KEY_ID, secretAccessKey: process.env.POSTBOX_SECRET },
    });
  }
  return ses;
}

function telegramChatId(lead = {}) {
  const explicit = clean(lead.telegramChatId, 80);
  if (/^-?\d+$/.test(explicit)) return explicit;
  const raw = clean(lead.telegram, 300);
  return /^-?\d+$/.test(raw) ? raw : '';
}

function vkPeerId(lead = {}) {
  const explicit = clean(lead.vkPeerId, 80);
  if (/^\d+$/.test(explicit)) return explicit;
  const raw = clean(lead.vk, 300);
  const match = raw.match(/(?:vk\.com\/)?id(\d+)$/i);
  return match?.[1] || (/^\d+$/.test(raw) ? raw : '');
}

export function availableOutreachChannels(lead = {}, env = process.env) {
  const channels = [];
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(lead.email, 320)) && env.POSTBOX_KEY_ID && env.POSTBOX_SECRET) channels.push('email');
  if (vkPeerId(lead) && (env.VK_GROUP_TOKEN || env.VK_USER_TOKEN)) channels.push('vk');
  if (telegramChatId(lead) && env.TELEGRAM_BOT_TOKEN) channels.push('telegram');
  return channels;
}

async function sendEmail(lead, text) {
  await getSes().send(new SendEmailCommand({
    FromEmailAddress: 'АПГ <noreply@myapg.ru>',
    Destination: { ToAddresses: [clean(lead.email, 320)] },
    Content: { Simple: {
      Subject: { Data: `Предложение о сотрудничестве для ${clean(lead.name, 120) || 'вашей компании'}`, Charset: 'UTF-8' },
      Body: { Text: { Data: text, Charset: 'UTF-8' } },
    } },
  }));
  return { channel: 'email' };
}

async function sendVk(lead, text) {
  const token = process.env.VK_GROUP_TOKEN || process.env.VK_USER_TOKEN;
  const body = new URLSearchParams({
    access_token: token,
    v: process.env.VK_API_VERSION || '5.199',
    peer_id: vkPeerId(lead),
    random_id: String(Math.floor(Math.random() * 2147483647) + 1),
    message: text,
  });
  const response = await fetch('https://api.vk.com/method/messages.send', { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error || !payload.response) throw new Error(clean(payload.error?.error_msg || 'VK не принял сообщение.', 300));
  return { channel: 'vk', providerMessageId: String(payload.response) };
}

async function sendTelegram(lead, text) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramChatId(lead), text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(clean(payload.description || 'Telegram не принял сообщение.', 300));
  return { channel: 'telegram', providerMessageId: String(payload.result?.message_id || '') };
}

const SENDERS = { email: sendEmail, vk: sendVk, telegram: sendTelegram };

export async function sendSalesOutreach(lead = {}, text = '', preferredChannel = 'auto') {
  const message = clean(text);
  if (!message) throw Object.assign(new Error('Текст сообщения пуст.'), { statusCode: 400 });
  const available = availableOutreachChannels(lead);
  const channels = preferredChannel === 'auto' ? available : available.filter(channel => channel === preferredChannel);
  if (!channels.length) {
    throw Object.assign(new Error('Нет доступного адресата или канал не настроен.'), { statusCode: 409, code: 'sales-ai/no-outreach-channel' });
  }
  const errors = [];
  for (const channel of channels) {
    try {
      return { ...(await SENDERS[channel](lead, message)), attemptedChannels: channels, sentAt: new Date().toISOString() };
    } catch (error) {
      errors.push({ channel, error: clean(error?.message, 300) });
    }
  }
  throw Object.assign(new Error('Все доступные каналы отклонили сообщение.'), { statusCode: 502, code: 'sales-ai/outreach-failed', channelErrors: errors });
}

