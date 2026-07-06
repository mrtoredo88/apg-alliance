import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDieP_idJhPrOYA8drW3cZjFNibmnPzBxQ',
  authDomain: 'project-apg-bbfc8.firebaseapp.com',
  projectId: 'project-apg-bbfc8',
  storageBucket: 'project-apg-bbfc8.firebasestorage.app',
  messagingSenderId: '946188358768',
  appId: '1:946188358768:web:a7fb6f6586ffdaf0b010b5',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function geocode(address) {
  const q = encodeURIComponent(`${address}, Зеленоград`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ru`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'ru', 'User-Agent': 'APG-Geocoder/1.0' } });
  const json = await res.json();
  if (!json.length) return null;
  return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const snap = await getDocs(collection(db, 'partners'));
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const toGeo = all.filter(p => p.address && (!p.latitude || !p.longitude));

  console.log(`Всего партнёров: ${all.length}, нужно геокодировать: ${toGeo.length}`);
  if (!toGeo.length) { console.log('Ничего делать.'); process.exit(0); }

  let ok = 0, fail = 0;
  for (let i = 0; i < toGeo.length; i++) {
    const p = toGeo[i];
    process.stdout.write(`[${i + 1}/${toGeo.length}] ${p.name} — "${p.address}" ... `);
    try {
      const coords = await geocode(p.address);
      if (coords) {
        await updateDoc(doc(db, 'partners', p.id), { latitude: coords.lat, longitude: coords.lon });
        console.log(`✓ ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`);
        ok++;
      } else {
        console.log('✗ не найдено');
        fail++;
      }
    } catch (e) {
      console.log(`✗ ошибка: ${e.message}`);
      fail++;
    }
    if (i < toGeo.length - 1) await sleep(1200);
  }

  console.log(`\nГотово: ${ok} обновлено, ${fail} не найдено`);
  process.exit(0);
}

main().catch(e => { console.warn(e); process.exit(1); });
