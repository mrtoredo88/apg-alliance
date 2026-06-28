// POST /api/upload-photo
// Accepts { folder, filename, contentType, data: base64 }
// Uploads to Yandex Cloud server-side (no CORS needed)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = 'apg-photos';
const ENDPOINT = 'https://storage.yandexcloud.net';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

let _client = null;
function getClient() {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: ENDPOINT,
    region: 'ru-central1',
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: process.env.YC_ACCESS_KEY,
      secretAccessKey: process.env.YC_SECRET_KEY,
    },
  });
  return _client;
}

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { folder, filename, contentType, data } = req.body ?? {};

  if (!folder || !filename || !contentType || !data) {
    return res.status(400).json({ error: 'folder, filename, contentType, data required' });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'invalid content type' });
  }

  const buffer = Buffer.from(data, 'base64');
  const timestamp = Date.now();
  const ext = contentType === 'image/webp' ? 'webp' : contentType === 'image/png' ? 'png' : 'jpg';
  const key = `${folder}/${timestamp}_${filename.replace(/[^a-z0-9._-]/gi, '_')}.${ext}`;

  await getClient().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  res.json({ url: `${ENDPOINT}/${BUCKET}/${key}` });
}
