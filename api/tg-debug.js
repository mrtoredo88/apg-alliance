// GET /api/tg-debug?tg_id=12345
// Диагностика: проверяет оба метода получения фото для заданного Telegram ID
export default async function handler(req, res) {
  const { tg_id } = req.query;
  if (!tg_id) return res.status(400).json({ error: 'tg_id required' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });

  async function getFile(fileId) {
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`).then(r => r.json());
    if (!r.ok) return { error: r.description };
    const path = r.result?.file_path;
    return { file_path: path, url: path ? `https://api.telegram.org/file/bot${token}/${path}` : null };
  }

  const [photos, chat] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${tg_id}&limit=1`).then(r => r.json()),
    fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${tg_id}`).then(r => r.json()),
  ]);

  let photosFile = null;
  if (photos.ok && photos.result?.photos?.length) {
    const sizes = photos.result.photos[0];
    photosFile = await getFile(sizes[sizes.length - 1].file_id);
  }

  let chatFile = null;
  if (chat.ok && chat.result?.photo?.big_file_id) {
    chatFile = await getFile(chat.result.photo.big_file_id);
  }

  return res.json({
    tg_id,
    getUserProfilePhotos: { ok: photos.ok, count: photos.result?.total_count ?? 0, file: photosFile },
    getChat:              { ok: chat.ok, hasPhoto: !!chat.result?.photo, file: chatFile },
  });
}
