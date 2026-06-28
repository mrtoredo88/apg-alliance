// POST /api/upload-sign
// Returns a presigned PUT URL for direct upload to Yandex Cloud Object Storage
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = 'apg-photos';
const ENDPOINT = 'https://storage.yandexcloud.net';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getClient() {
  return new S3Client({
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
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { folder, filename, contentType } = req.body ?? {};

  if (!folder || !filename || !contentType) {
    return res.status(400).json({ error: 'folder, filename, contentType required' });
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return res.status(400).json({ error: 'invalid content type' });
  }

  const timestamp = Date.now();
  const ext = contentType === 'image/webp' ? 'webp' : contentType === 'image/png' ? 'png' : 'jpg';
  const key = `${folder}/${timestamp}_${filename.replace(/[^a-z0-9._-]/gi, '_')}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const signedUrl = await getSignedUrl(getClient(), command, { expiresIn: 600 });
  const publicUrl = `${ENDPOINT}/${BUCKET}/${key}`;

  res.json({ signedUrl, publicUrl });
}
