import { readFile } from 'node:fs/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'server/firebase-service-account.json';
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const APP_URL = process.env.APP_URL || 'https://myapg.ru';
const DEMO_ID = 'demo-partner-apg';

async function resolveOwner() {
  const envEmail = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (envEmail) {
    const direct = await db.collection('users').doc(`email:${envEmail}`).get().catch(() => null);
    if (direct?.exists) return { id: direct.id, email: envEmail, data: direct.data() || {} };
    const byEmail = await db.collection('users').where('email', '==', envEmail).limit(1).get();
    if (!byEmail.empty) return { id: byEmail.docs[0].id, email: envEmail, data: byEmail.docs[0].data() || {} };
    return { id: `email:${envEmail}`, email: envEmail, data: {} };
  }
  const ownerSnap = await db.collection('users').where('role', '==', 'owner').limit(1).get();
  if (!ownerSnap.empty) {
    const doc = ownerSnap.docs[0];
    const data = doc.data() || {};
    const email = String(data.email || data.login || data.linkedEmail || '').trim().toLowerCase();
    if (!email) throw new Error('Owner user found, but email is empty. Run with OWNER_EMAIL=...');
    return { id: doc.id, email, data };
  }
  throw new Error('Owner user not found. Run with OWNER_EMAIL=owner@example.com');
}

const owner = await resolveOwner();
const logo = `${APP_URL}/logo.png`;
const cover = `${APP_URL}/splash-v43.png`;
const icon = `${APP_URL}/icon.png`;

const partner = {
  name: 'Демо-партнёр АПГ',
  description: [
    'Идеальная демонстрационная карточка партнёра: здесь собраны акции, QR-механики, события, новости, отзывы, галерея, контакты и аналитика.',
    'Партнёр показывает, как бизнес может выглядеть внутри АПГ после качественного оформления профиля и запуска программы лояльности.',
    'Используйте эту карточку на презентациях: она демонстрирует путь от просмотра карточки до визита, сканирования QR, отзыва и повторного контакта.',
  ].join('\n\n'),
  category: 'services',
  categoryLabel: 'Услуги',
  emoji: '🏙️',
  logoUrl: logo,
  coverPhoto: cover,
  gallery: [cover, logo, icon],
  photos: [cover, logo, icon],
  videos: [
    {
      url: 'https://vk.com/video-1_456239017',
      title: 'Как партнёр использует АПГ',
      platform: 'vk',
      thumbnailUrl: cover,
    },
  ],
  offer: 'Демо-акция: +2 ключа за первый визит, персональный бонус после QR-скана и welcome-подарок для участников АПГ.',
  benefits: [
    'Привлечение новых клиентов из городской аудитории',
    'QR-лояльность без сложной интеграции',
    'Отзывы, события, новости и аналитика в одном кабинете',
    'Поддержка продвижения через АПГ, VK, Telegram и push-план',
  ],
  badge: 'Идеальная карточка',
  tier: 'alliance',
  verifiedPartner: true,
  featured: true,
  active: true,
  catalogPublished: true,
  status: 'published',
  lifecycleStatus: 'verified_partner',
  lifecycleStatusLabel: 'Проверенный партнёр',
  connectionStatus: 'card_active',
  connectionStatusLabel: 'Карточка активна',
  publicationConsentAccepted: true,
  ownerId: owner.id,
  ownerEmail: owner.email,
  connectionEmail: owner.email,
  phone: '+7 (499) 000-00-00',
  address: 'Зеленоград, Центральная площадь, демо-пространство АПГ',
  latitude: 55.9871,
  longitude: 37.2022,
  hours: 'Пн–Пт 10:00–20:00, Сб–Вс 11:00–18:00',
  websiteUrl: APP_URL,
  bookingUrl: `${APP_URL}/#/partners`,
  socialUrl: 'https://vk.com/apg',
  vkGroupUrl: 'https://vk.com/apg',
  telegramCommunityUrl: 'https://t.me/apg_demo',
  maxCommunityUrl: 'https://max.ru/apg',
  whatsappUrl: 'https://wa.me/79990000000',
  instagramUrl: 'https://instagram.com/apg.demo',
  youtubeUrl: 'https://youtube.com/@apg-demo',
  links: [
    { label: 'Сайт АПГ', url: APP_URL },
    { label: 'VK', url: 'https://vk.com/apg' },
    { label: 'Telegram', url: 'https://t.me/apg_demo' },
  ],
  stampTarget: 5,
  publicQRUrl: `${APP_URL}/?partner=${DEMO_ID}`,
  serviceQRValue: DEMO_ID,
  qrOpenCount: 74,
  qrOpens: 74,
  publicQRScans: 128,
  totalVisits: 214,
  viewCount: 1840,
  favoritesCount: 96,
  routeClicks: 41,
  websiteClicks: 156,
  siteClicks: 156,
  vkClicks: 88,
  telegramClicks: 67,
  phoneClicks: 23,
  newClients: 87,
  referredClients: 34,
  issuedBonuses: 312,
  eventVisits: 46,
  newsViews: 920,
  newsClicks: 143,
  weeklyDynamics: [22, 31, 28, 44, 52, 47, 61],
  monthlyDynamics: [148, 176, 213, 241],
  avgRating: 4.9,
  reviewCount: 8,
  firstNewsCreatedAt: new Date().toISOString(),
  firstEventCreatedAt: new Date().toISOString(),
  firstShareAt: new Date().toISOString(),
  firstReviewInviteAt: new Date().toISOString(),
  demo: true,
  demoLabel: 'Демо',
  demoPurpose: 'presentation',
  archived: false,
  archivedAt: null,
  archivedBy: null,
  updatedAt: FieldValue.serverTimestamp(),
  createdAt: FieldValue.serverTimestamp(),
};

const partnerRef = db.collection('partners').doc(DEMO_ID);
await partnerRef.set(partner, { merge: true });

const reviews = [
  ['demo-review-1', 'Анна, кофейня', 5, 'Понятно видно, как карточка приводит людей из просмотра в реальный визит. QR и акции выглядят очень убедительно.'],
  ['demo-review-2', 'Илья, студия услуг', 5, 'Кабинет показывает именно те цифры, которые нужны бизнесу: просмотры, переходы, сканы и отзывы.'],
  ['demo-review-3', 'Мария, эксперт', 5, 'Отличный пример того, как можно собрать события, новости и лояльность в одной системе.'],
  ['demo-review-4', 'Пользователь АПГ', 5, 'Карточка выглядит живой: есть фото, акция, адрес, рейтинг и быстрые ссылки.'],
];

for (const [id, userName, stars, text] of reviews) {
  const data = {
    userId: id,
    userName,
    stars,
    rating: stars,
    text,
    partnerId: DEMO_ID,
    partnerName: partner.name,
    demo: true,
    createdAt: FieldValue.serverTimestamp(),
  };
  await partnerRef.collection('reviews').doc(id).set(data, { merge: true });
  await db.collection('reviews').doc(`${DEMO_ID}_${id}`).set(data, { merge: true });
}

await db.collection('news').doc('demo-partner-apg-news').set({
  title: 'Демо-партнёр АПГ показывает возможности платформы',
  summary: 'Карточка, акции, QR, отзывы, события и аналитика в одном примере.',
  text: 'Это демонстрационная публикация для презентаций АПГ потенциальным партнёрам. Она показывает, как партнёр может выглядеть в приложении после полноценного оформления.',
  sourceName: partner.name,
  category: 'partners',
  imageUrl: cover,
  partnerId: DEMO_ID,
  active: true,
  status: 'published',
  commentsEnabled: true,
  demo: true,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

const eventDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
await db.collection('events').doc('demo-partner-apg-event').set({
  title: 'Демо-встреча: как партнёру получать клиентов через АПГ',
  emoji: '🎓',
  description: 'Презентационное мероприятие, которое показывает путь партнёра: карточка, QR, акция, новость, событие и аналитика.',
  eventDate: eventDate.toISOString().slice(0, 10),
  startAt: eventDate,
  partner: partner.name,
  partnerId: DEMO_ID,
  partnerName: partner.name,
  address: partner.address,
  locationMode: 'hybrid',
  coverPhoto: cover,
  maxParticipants: 40,
  registeredCount: 23,
  active: true,
  status: 'published',
  demo: true,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

await db.collection('users').doc(owner.id).set({
  partnerId: DEMO_ID,
  ownerPartnerId: DEMO_ID,
  partnerCabinetIds: FieldValue.arrayUnion(DEMO_ID),
  updatedAt: FieldValue.serverTimestamp(),
  ...(owner.email ? { email: owner.email } : {}),
}, { merge: true });

console.log(JSON.stringify({
  ok: true,
  partnerId: DEMO_ID,
  ownerUserId: owner.id,
  ownerEmail: owner.email,
}, null, 2));
