import { createHmac, createHash } from 'crypto';
import { request as httpsRequest } from 'https';

const BUCKET = 'apg-photos';
const HOST = 'storage.yandexcloud.net';
const REGION = 'ru-central1';
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function sha256hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function s3Put(key, body, contentType) {
  const accessKey = process.env.YC_ACCESS_KEY;
  const secretKey = process.env.YC_SECRET_KEY;

  const now = new Date();
  const dateTime = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const date = dateTime.slice(0, 8);

  const bodyHash = sha256hex(body);
  const path = `/${BUCKET}/${key}`;

  const headers = {
    host: HOST,
    'content-type': contentType,
    'content-length': String(body.length),
    'x-amz-content-sha256': bodyHash,
    'x-amz-date': dateTime,
  };

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}`).join('\n') + '\n';
  const signedHeaders = sortedKeys.join(';');

  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');

  const scope = `${date}/${REGION}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', dateTime, scope, sha256hex(canonicalRequest)].join('\n');

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), REGION), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      { hostname: HOST, method: 'PUT', path, headers: { ...headers, authorization } },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`S3 ${res.statusCode}: ${data}`));
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
    const ext = contentType === 'image/webp' ? 'webp' : contentType === 'image/png' ? 'png' : 'jpg';
    const key = `${folder}/${timestamp}_${filename.replace(/[^a-z0-9._-]/gi, '_')}.${ext}`;

    try {
      await s3Put(key, buffer, contentType);
    } catch (e) {
      request.log.error({ err: e.message }, 'S3 upload failed');
      return reply.code(500).send({ error: e.message });
    }

    return { url: `https://${HOST}/${BUCKET}/${key}` };
  });
}
