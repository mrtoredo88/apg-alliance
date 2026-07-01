const GROUP_ID = 229980067;

function pickBestPhoto(sizes = []) {
  const preferred = ['x', 'r', 'q', 'p', 'o', 'z', 'm', 's'];
  for (const type of preferred) {
    const s = sizes.find(s => s.type === type);
    if (s) return s.url;
  }
  return sizes[sizes.length - 1]?.url ?? null;
}

function mapPost(post) {
  let imageUrl = null;
  const photoAttach = post.attachments?.find(a => a.type === 'photo');
  if (photoAttach?.photo?.sizes?.length) imageUrl = pickBestPhoto(photoAttach.photo.sizes);

  const lines = (post.text ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const title = lines[0]?.slice(0, 90) || 'АПГ Зеленоград';
  const text  = lines.slice(1).join('\n').trim() || lines[0] || '';

  return {
    id:        `vk_${post.id}`,
    title,
    text,
    imageUrl,
    emoji:     imageUrl ? null : '📢',
    createdAt: post.date * 1000,        // unix ms — клиент сам форматирует
    linkUrl:   `https://vk.com/wall-${GROUP_ID}_${post.id}`,
    linkLabel: 'Открыть в ВКонтакте',
    source:    'vk',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const token = process.env.VK_GROUP_TOKEN;
  if (!token) return res.status(500).json({ error: 'token_missing' });

  try {
    const apiUrl = new URL('https://api.vk.com/method/wall.get');
    apiUrl.searchParams.set('owner_id', String(-GROUP_ID));
    apiUrl.searchParams.set('count', '10');
    apiUrl.searchParams.set('filter', 'owner');
    apiUrl.searchParams.set('access_token', token);
    apiUrl.searchParams.set('v', '5.199');

    const r = await fetch(apiUrl.toString());
    const data = await r.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.error_msg });
    }

    const posts = (data.response?.items ?? [])
      .filter(p => p.text?.trim() || p.attachments?.some(a => a.type === 'photo'))
      .map(mapPost);

    res.json({ posts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
