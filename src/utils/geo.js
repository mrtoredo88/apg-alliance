const toRad = d => d * Math.PI / 180;

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km < 0.1)  return '< 100 м';
  if (km < 1)    return `${Math.round(km * 1000 / 10) * 10} м`;
  if (km < 10)   return `${km.toFixed(1)} км`;
  return `${Math.round(km)} км`;
}

export async function geocodeAddress(address) {
  const q = encodeURIComponent(`${address}, Зеленоград`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ru`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'ru' } });
  const json = await res.json();
  if (!json.length) return null;
  return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
}
