# APG Telegram relay

Cloudflare Worker that bridges Telegram and the APG backend when direct network
traffic between Telegram and Yandex Serverless is unavailable.

Required Worker secrets:

- `TELEGRAM_BOT_TOKEN`
- `WEBHOOK_SECRET`
- `BACKEND_SECRET`
- `RELAY_SECRET`

The relay stores no Telegram updates or user data.
