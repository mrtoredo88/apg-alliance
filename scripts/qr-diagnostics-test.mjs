import assert from 'node:assert/strict';
import { getQrRouteContext, sanitizeQrPartnerSnapshot } from '../src/qrDiagnostics.js';

const emptyContext = getQrRouteContext({ partnerId: 'demo' });
assert.equal(emptyContext.partnerId, 'demo');

const snapshot = sanitizeQrPartnerSnapshot({
  id: 'partner-1',
  name: 'Demo Partner',
  catalogPublished: true,
  address: 'Hidden address',
  phone: 'Hidden phone',
  locations: [{ isMain: true, address: 'Hidden branch address' }],
  photos: ['a.jpg'],
  gallery: ['b.jpg'],
  videos: ['video'],
  serviceCatalog: [{ title: 'Service' }],
});

assert.deepEqual(snapshot, {
  id: 'partner-1',
  title: 'Demo Partner',
  status: '',
  catalogPublished: true,
  locations: {
    count: 1,
    hasMain: true,
    fallbackAddress: true,
  },
  media: {
    cover: false,
    logo: false,
    photos: 1,
    gallery: 1,
    images: 0,
    videos: 1,
  },
  services: {
    text: false,
    catalog: 1,
  },
});

assert.equal(JSON.stringify(snapshot).includes('Hidden'), false);

console.log('QR diagnostics test passed');
