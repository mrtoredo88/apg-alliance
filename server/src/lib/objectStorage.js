import { createHmac, createHash } from 'crypto';
import { request as httpsRequest } from 'https';

const BUCKET = 'apg-photos';
const HOST = 'storage.yandexcloud.net';
const REGION = 'ru-central1';

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function sha256hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function publicObjectUrl(key) {
  return `https://${HOST}/${BUCKET}/${key}`;
}

export function putPublicObject(key, body, contentType) {
  const accessKey = process.env.YC_ACCESS_KEY;
  const secretKey = process.env.YC_SECRET_KEY;
  if (!accessKey || !secretKey) throw new Error('Object storage credentials are not configured');

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
  const canonicalHeaders = sortedKeys.map(name => `${name}:${headers[name]}`).join('\n') + '\n';
  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, bodyHash].join('\n');
  const scope = `${date}/${REGION}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', dateTime, scope, sha256hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), REGION), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      { hostname: HOST, method: 'PUT', path, headers: { ...headers, authorization } },
      response => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          if (response.statusCode === 200) resolve(publicObjectUrl(key));
          else reject(new Error(`S3 ${response.statusCode}: ${data}`));
        });
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}
