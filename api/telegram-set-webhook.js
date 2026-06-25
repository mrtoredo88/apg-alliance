// POST /api/telegram-set-webhook
// Регистрирует или проверяет вебхук Telegram бота.
// Защищён RAFFLE_SECRET.
//
// Body: { secret, action: 'set' | 'info' | 'delete' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { secret, action = 'set' } = req.body ?? {};
  if (secret !== process.env.RAFFLE_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });

  const base = `https://api.telegram.org/bot${token}`;

  if (action === 'info') {
    const r = await fetch(`${base}/getWebhookInfo`).then(r => r.json());
    return res.json(r);
  }

  if (action === 'delete') {
    const r = await fetch(`${base}/deleteWebhook`, { method: 'POST' }).then(r => r.json());
    return res.json(r);
  }

  // action === 'set'
  const webhookUrl = `https://apg-alliance.vercel.app/api/telegram-webhook`;
  const r = await fetch(`${base}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      url:             webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  }).then(r => r.json());

  return res.json(r);
}
