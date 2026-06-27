// One-time admin endpoint: geocodes all partners missing lat/lon
// DELETE this file after use
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const TOKEN = 'apg-geo-2026';

function getAdminApp() {
  const existing = getApps().find(a => a.name === 'apg-geo');
  if (existing) return existing;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) }, 'apg-geo');
}

function normalizeZelenograd(address) {
  let a = address.trim();
  a = a.replace(/^г\.?\s*зеленоград[,\s]*/i, '').trim();
  a = a.replace(/\bк\.?\s*(\d+)/i, 'корпус $1');
  a = a.replace(/\bкорп\.?\s*(\d+)/i, 'корпус $1');
  a = a.replace(/\bр\.?п\.?\s*андреевка/i, 'деревня Андреевка');
  a = a.replace(/\bп\.?\s*андреевка/i, 'деревня Андреевка');
  a = a.replace(/\bрп\s*андреевка/i, 'деревня Андреевка');
  a = a.replace(/\bЖК\s+/i, '');
  a = a.replace(/\bстр\.?\s*(\d+)/i, 'строение $1');
  return a;
}

async function nominatim(query) {
  const q = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ru`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'ru', 'User-Agent': 'APG-Admin-Geocoder/1.0 (zelcenter01@gmail.com)' } });
  const json = await res.json();
  return json.length ? { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon), display: json[0].display_name } : null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocodeBest(address) {
  const norm = normalizeZelenograd(address);
  const isAndreevka = /андреевка/i.test(address);
  const queries = [
    `${address}, Зеленоград, Москва`,
    `${norm}, Зеленоград, Москва`,
    `${norm}, Солнечногорск, Московская область`,
    `${norm}, Москва`,
    address,
    norm,
    ...(isAndreevka ? ['деревня Андреевка, Солнечногорск, Московская область'] : []),
  ];
  for (const q of queries) {
    await sleep(1100);
    const result = await nominatim(q);
    if (result) return { ...result, query: q };
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers.authorization ?? '';
  if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ error: 'unauthorized' });

  try {
    const app = getAdminApp();
    const db = getFirestore(app);

    // Accept manual overrides: { manual: [{ id, lat, lon }] }
    const body = req.body ?? {};
    if (Array.isArray(body.manual) && body.manual.length) {
      const manualResults = [];
      for (const m of body.manual) {
        await db.collection('partners').doc(m.id).update({ latitude: m.lat, longitude: m.lon });
        manualResults.push({ id: m.id, ok: true, lat: m.lat, lon: m.lon, query: 'manual' });
      }
      return res.json({ total: body.manual.length, results: manualResults });
    }

    const snap = await db.collection('partners').get();
    const toGeo = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.address && (!p.latitude || !p.longitude));

    const results = [];
    for (const p of toGeo) {
      const found = await geocodeBest(p.address);
      if (found) {
        await db.collection('partners').doc(p.id).update({ latitude: found.lat, longitude: found.lon });
        results.push({ id: p.id, name: p.name, address: p.address, ok: true, lat: found.lat, lon: found.lon, query: found.query });
      } else {
        results.push({ id: p.id, name: p.name, address: p.address, ok: false });
      }
    }

    res.json({ total: toGeo.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
