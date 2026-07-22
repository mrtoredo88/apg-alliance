import { putPublicObject } from '../lib/objectStorage.js';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function extensionFor(contentType) {
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  return 'jpg';
}

export default async function uploadPhotoRoutes(fastify) {
  fastify.post('/api/upload-photo', async (request, reply) => {
    const { folder, filename, contentType, data } = request.body ?? {};

    if (!folder || !filename || !contentType || !data)
      return reply.code(400).send({ error: 'folder, filename, contentType, data required' });
    if (!ALLOWED_TYPES.includes(contentType))
      return reply.code(400).send({ error: 'invalid content type' });

    const buffer = Buffer.from(data, 'base64');
    const timestamp = Date.now();
    const ext = extensionFor(contentType);
    const key = `${folder}/${timestamp}_${filename.replace(/[^a-z0-9._-]/gi, '_')}.${ext}`;

    try {
      await putPublicObject(key, buffer, contentType);
    } catch (e) {
      request.log.error({ err: e.message }, 'S3 upload failed');
      return reply.code(500).send({ error: e.message });
    }

    return { url: `https://storage.yandexcloud.net/apg-photos/${key}` };
  });
}
