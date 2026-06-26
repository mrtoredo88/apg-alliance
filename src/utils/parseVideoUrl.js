const YT_THUMB = id => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const VK_THUMB  = '/video-placeholder-vk.svg';
const RT_THUMB  = '/video-placeholder-rt.svg';

export function parseVideoUrl(raw) {
  if (!raw) return null;
  const url = raw.trim();

  // YouTube
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (host === 'youtube.com' || host === 'youtu.be') {
      let id = null;
      if (host === 'youtu.be') {
        id = u.pathname.slice(1).split('?')[0];
      } else if (u.pathname.startsWith('/shorts/')) {
        id = u.pathname.split('/shorts/')[1].split('?')[0];
      } else {
        id = u.searchParams.get('v');
      }
      if (!id) return null;
      return {
        platform:     'youtube',
        videoId:      id,
        embedUrl:     `https://www.youtube.com/embed/${id}`,
        thumbnailUrl: YT_THUMB(id),
      };
    }

    // VK Видео
    if (host === 'vk.com' || host === 'vkvideo.ru') {
      const match = u.pathname.match(/video(-?\d+)_(\d+)/);
      if (!match) return null;
      const ownerId = match[1];
      const videoId = match[2];
      return {
        platform:     'vk',
        videoId:      `${ownerId}_${videoId}`,
        embedUrl:     `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&hd=2`,
        thumbnailUrl: VK_THUMB,
      };
    }

    // Rutube
    if (host === 'rutube.ru') {
      const match = u.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
      if (!match) return null;
      const id = match[1];
      return {
        platform:     'rutube',
        videoId:      id,
        embedUrl:     `https://rutube.ru/play/embed/${id}`,
        thumbnailUrl: RT_THUMB,
      };
    }
  } catch {
    return null;
  }

  return null;
}
