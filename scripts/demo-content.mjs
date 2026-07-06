import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = 'project-apg-bbfc8';
const DEMO_SOURCE = 'demo';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.warn('Demo Content writes are allowed only with FIRESTORE_EMULATOR_HOST, for example: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run demo:seed');
  process.exit(1);
}

if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const img = (id, w = 1400, h = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=82`;

const IMAGES = {
  city: [
    img('photo-1519501025264-65ba15a82390'),
    img('photo-1449824913935-59a10b8d2000'),
    img('photo-1494526585095-c41746248156'),
    img('photo-1500530855697-b586d89ba3ee'),
  ],
  events: [
    img('photo-1517457373958-b7bdd4587205'),
    img('photo-1528605248644-14dd04022da1'),
    img('photo-1511795409834-ef04bbd61622'),
    img('photo-1505373877841-8d25f7d46678'),
    img('photo-1540575467063-178a50c2df87'),
    img('photo-1501281668745-f7f57925c3b4'),
  ],
  food: [
    img('photo-1517248135467-4c7edcad34c4'),
    img('photo-1555396273-367ea4eb4db5'),
    img('photo-1551218808-94e220e084d2'),
  ],
  sport: [
    img('photo-1518611012118-696072aa579a'),
    img('photo-1517836357463-d25dfeac3438'),
  ],
  beauty: [
    img('photo-1560066984-138dadb4c035'),
    img('photo-1522335789203-aabd1fc54bc9'),
  ],
  culture: [
    img('photo-1500534314209-a25ddb2bd429'),
    img('photo-1505236858219-8359eb29e329'),
  ],
  rewards: [
    img('photo-1512909006721-3d6018887383'),
    img('photo-1513201099705-a9746e1e201f'),
    img('photo-1549465220-1a8b9238cd48'),
  ],
};

const demo = extra => ({ ...extra, isDemo: true, source: DEMO_SOURCE, demoCreatedAt: FieldValue.serverTimestamp() });
const ts = value => Timestamp.fromDate(new Date(value));
const day = offset => new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
const dateLabel = (date) => date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const timeLabel = (h, m = '00') => `${String(h).padStart(2, '0')}:${m}`;

const users = [
  ['demo_user_01', 'Анна Соколова', 74, 'https://i.pravatar.cc/160?img=47'],
  ['demo_user_02', 'Илья Морозов', 41, 'https://i.pravatar.cc/160?img=12'],
  ['demo_user_03', 'Мария Лебедева', 128, 'https://i.pravatar.cc/160?img=32'],
  ['demo_user_04', 'Даниил Орлов', 27, 'https://i.pravatar.cc/160?img=14'],
  ['demo_user_05', 'Екатерина Волкова', 56, 'https://i.pravatar.cc/160?img=45'],
  ['demo_user_06', 'Сергей Павлов', 93, 'https://i.pravatar.cc/160?img=52'],
  ['demo_user_07', 'Ольга Романова', 35, 'https://i.pravatar.cc/160?img=49'],
  ['demo_user_08', 'Никита Крылов', 18, 'https://i.pravatar.cc/160?img=15'],
  ['demo_user_09', 'Юлия Новикова', 66, 'https://i.pravatar.cc/160?img=44'],
  ['demo_user_10', 'Павел Егоров', 112, 'https://i.pravatar.cc/160?img=59'],
  ['demo_user_11', 'Алина Смирнова', 22, 'https://i.pravatar.cc/160?img=5'],
  ['demo_user_12', 'Максим Фомин', 84, 'https://i.pravatar.cc/160?img=60'],
];

const partners = [
  ['demo_partner_01', 'Кофейня «Северный свет»', 'food', '☕', 'Скидка 15% на авторский кофе до 12:00', IMAGES.food[0]],
  ['demo_partner_02', 'Семейная пекарня «Булочная 15»', 'food', '🥐', 'Каждый пятый круассан в подарок участникам АПГ', IMAGES.food[1]],
  ['demo_partner_03', 'Студия красоты «Линия»', 'beauty', '💄', 'Минус 20% на первое посещение мастера', IMAGES.beauty[0]],
  ['demo_partner_04', 'Фитнес-клуб «Импульс»', 'sport', '🏋️', 'Пробная тренировка за 1 ключ', IMAGES.sport[1]],
  ['demo_partner_05', 'Ресторан «Городской двор»', 'food', '🍽️', 'Комплимент от шефа при бронировании через АПГ', IMAGES.food[2]],
  ['demo_partner_06', 'Книжная лавка «Глава»', 'shopping', '📚', 'Скидка 10% на новинки месяца', IMAGES.culture[1]],
  ['demo_partner_07', 'Центр йоги «Тихий парк»', 'health', '🧘', 'Первое занятие со скидкой 30%', IMAGES.sport[0]],
  ['demo_partner_08', 'Детский клуб «Открытие»', 'education', '🎨', 'Бесплатный пробный мастер-класс', IMAGES.events[2]],
  ['demo_partner_09', 'Цветочная мастерская «Листья»', 'shopping', '🌿', 'Мини-букет в подарок к заказу от 2500 ₽', IMAGES.rewards[2]],
  ['demo_partner_10', 'Барбершоп «Квартал»', 'beauty', '✂️', 'Укладка в подарок к стрижке', IMAGES.beauty[1]],
];

const experts = [
  ['demo_expert_01', 'Ирина Белова', 'psychology', 'Психолог семейных отношений', IMAGES.beauty[0]],
  ['demo_expert_02', 'Артём Кузнецов', 'business', 'Консультант по малому бизнесу', IMAGES.events[1]],
  ['demo_expert_03', 'Елена Миронова', 'health', 'Нутрициолог и wellness-коуч', IMAGES.sport[0]],
  ['demo_expert_04', 'Виктор Ланской', 'finance', 'Финансовый наставник', IMAGES.city[0]],
  ['demo_expert_05', 'София Громова', 'education', 'Методист детских программ', IMAGES.events[2]],
  ['demo_expert_06', 'Михаил Фёдоров', 'law', 'Юрист для предпринимателей', IMAGES.events[4]],
];

const newsTitles = [
  'В Зеленограде открылось новое городское пространство для встреч',
  'К АПГ присоединились десять новых партнёров',
  'Гид выходного дня: куда сходить всей семьёй',
  'Летняя афиша парков: музыка, спорт и мастер-классы',
  'Партнёры подготовили неделю полезных акций',
  'Как жители используют ключи АПГ в городе',
  'Новый маршрут: кофе, прогулка и вечерний кинопоказ',
  'В городе пройдёт фестиваль локальных проектов',
  'Детские студии запускают открытые занятия',
  'Спортивные партнёры зовут на тренировки в парке',
  'Эксперты АПГ проведут серию бесплатных консультаций',
  'Большой городской нетворкинг соберёт предпринимателей',
  'Розыгрыши недели: сертификаты, билеты и подарочные наборы',
  'Открытия месяца: места, которые стоит добавить в избранное',
  'Культурный маршрут по Зеленограду на один вечер',
  'Семейные выходные: идеи для детей и родителей',
  'АПГ обновляет городскую карту партнёров',
  'Истории участников: как копятся ключи',
  'Новые подарки появились в витрине призов',
  'Пять поводов открыть приложение сегодня',
];

const eventTitles = [
  ['Большой нетворкинг города', '🤝', 'business', 2, 11],
  ['Мастер-класс по фотографии в парке', '📸', 'culture', 4, 15],
  ['Йога у Большого городского пруда', '🧘', 'sport', 5, 9],
  ['Бизнес-завтрак для локальных предпринимателей', '☕', 'business', 7, 10],
  ['Семейный фестиваль во дворе', '🎈', 'family', 8, 12],
  ['Лекция о личных финансах', '💡', 'education', 10, 19],
  ['Кинопоказ под открытым небом', '🎬', 'culture', 12, 20],
  ['Детская лаборатория творчества', '🎨', 'family', 13, 13],
  ['Выставка локальных художников', '🖼️', 'culture', 15, 18],
  ['Забег выходного дня', '🏃', 'sport', 16, 8],
  ['Музыкальный вечер на площади', '🎤', 'culture', 18, 19],
  ['Практикум для самозанятых', '📋', 'business', 20, 17],
  ['Маркет локальных брендов', '🛍️', 'shopping', 22, 12],
  ['Открытый урок английского для детей', '📚', 'education', 23, 16],
  ['Городская прогулка с гидом', '🚶', 'culture', 24, 11],
  ['Кулинарный мастер-класс', '🍝', 'food', 26, 14],
  ['Встреча книжного клуба', '📖', 'culture', 28, 18],
  ['Лекция о здоровом сне', '🌙', 'health', 30, 19],
  ['Турнир по настольным играм', '🎲', 'family', 32, 15],
  ['Закрытый вечер клуба АПГ', '✨', 'business', 35, 19],
];

const prizes = [
  ['Сертификат в кофейню', '☕', 'fixed', 15, 8, 'demo_partner_01'],
  ['Семейный набор выпечки', '🥐', 'fixed', 18, 6, 'demo_partner_02'],
  ['Скидка на тренировку', '🏋️', 'fixed', 12, 12, 'demo_partner_04'],
  ['Подарочный букет', '🌿', 'fixed', 25, 4, 'demo_partner_09'],
  ['Ужин на двоих', '🍽️', 'raffle', 5, 1, 'demo_partner_05'],
  ['Абонемент на йогу', '🧘', 'raffle', 4, 1, 'demo_partner_07'],
  ['Билеты на кинопоказ', '🎟️', 'raffle', 3, 1, null],
  ['Подарочный набор АПГ', '🎁', 'raffle', 2, 1, null],
];

const tasks = [
  ['visit-3-partners', 'Познакомиться с тремя партнёрами', 'Посетите три разных места и получите бонусные ключи', '🤝', 3],
  ['first-review', 'Оставить первый отзыв', 'Расскажите, что понравилось у партнёра или эксперта', '⭐', 2],
  ['weekend-route', 'Маршрут выходного дня', 'Откройте афишу и выберите мероприятие недели', '🗓️', 2],
  ['invite-friend', 'Пригласить друга', 'Поделитесь АПГ с другом из Зеленограда', '🔗', 5],
  ['discover-expert', 'Открыть эксперта', 'Посмотрите карточку эксперта и сохраните контакт', '🧑‍💼', 2],
];

async function deleteQuery(query) {
  const snap = await query.get();
  let count = 0;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    count += snap.docs.slice(i, i + 450).length;
  }
  return count;
}

async function clearDemo() {
  const collections = ['partners', 'experts', 'events', 'news', 'banners', 'prizes', 'customTasks', 'notifications', 'users', 'expertReviews', 'raffleEntries', 'prizeClaims', 'scans'];
  const result = {};
  for (const name of collections) {
    result[name] = await deleteQuery(db.collection(name).where('isDemo', '==', true));
  }
  result.partnerReviews = await deleteQuery(db.collectionGroup('reviews').where('isDemo', '==', true));
  result.userActivity = await deleteQuery(db.collectionGroup('activity').where('isDemo', '==', true));
  result.userClaims = await deleteQuery(db.collectionGroup('claims').where('isDemo', '==', true));
  return result;
}

async function seedDemo() {
  const cleared = await clearDemo();
  const batch = db.batch();

  partners.forEach((p, index) => {
    const [id, name, category, emoji, offer, image] = p;
    batch.set(db.collection('partners').doc(id), demo({
      name, category, emoji, offer,
      description: `Демонстрационный партнёр АПГ. ${name} участвует в городской программе, принимает ключи и готовит специальные предложения для жителей Зеленограда.`,
      logoUrl: image,
      imageUrl: image,
      coverPhoto: image,
      photos: [image, IMAGES.city[index % IMAGES.city.length], IMAGES.events[index % IMAGES.events.length]],
      address: `Зеленоград, корпус ${100 + index * 11}`,
      latitude: 55.982 + index * 0.003,
      longitude: 37.18 + index * 0.004,
      phone: '+7 999 100-20-' + String(10 + index).padStart(2, '0'),
      websiteUrl: 'https://myapg.ru',
      socialUrl: 'https://vk.com',
      workingHours: 'ежедневно 10:00–21:00',
      active: true,
      featured: index === 0,
      partnerOfMonth: index === 4,
      premium: index % 3 === 0,
      verified: true,
      keys: index === 0 ? 2 : 1,
      avgRating: 4.6 + (index % 4) / 10,
      reviewCount: 8 + index,
      totalVisits: 38 + index * 9,
      favoritesCount: 12 + index * 3,
      publicQRScans: 20 + index * 5,
      createdAt: FieldValue.serverTimestamp(),
      linksCheckedAt: FieldValue.serverTimestamp(),
    }));
  });

  experts.forEach((e, index) => {
    const [id, name, category, specialization, image] = e;
    batch.set(db.collection('experts').doc(id), demo({
      name, category, specialization,
      description: `Демонстрационный эксперт АПГ. ${name} помогает жителям и предпринимателям Зеленограда разбираться в практических задачах и находить понятные решения.`,
      photo: image,
      coverPhoto: image,
      photos: [image, IMAGES.events[(index + 2) % IMAGES.events.length]],
      formats: index % 2 ? ['online', 'offline'] : ['offline', 'group'],
      tier: index % 2 ? 'member' : 'ambassador',
      active: true,
      premium: index === 1,
      verified: true,
      keys: 1,
      avgRating: 4.7 + (index % 3) / 10,
      reviewCount: 6 + index,
      totalVisits: 22 + index * 7,
      viewCount: 80 + index * 15,
      publicQRScans: 12 + index * 4,
      createdAt: FieldValue.serverTimestamp(),
      linksCheckedAt: FieldValue.serverTimestamp(),
    }));
  });

  users.forEach(([id, name, keys, photo], index) => {
    batch.set(db.collection('users').doc(id), demo({
      name, displayName: name, photo, keys,
      authProvider: 'demo',
      favorites: partners.slice(index % 3, index % 3 + 3).map(p => p[0]),
      completedTasks: tasks.slice(0, 2 + (index % 3)).map(t => t[0]),
      streak: 2 + (index % 8),
      scannedPartners: Object.fromEntries(partners.slice(0, 4).map((p, i) => [p[0], 1 + ((index + i) % 4)])),
      scannedExperts: Object.fromEntries(experts.slice(0, 2).map((e, i) => [e[0], 1 + ((index + i) % 2)])),
      referralCount: index % 5,
      createdAt: FieldValue.serverTimestamp(),
    }));
  });

  newsTitles.forEach((title, index) => {
    const image = [...IMAGES.city, ...IMAGES.events, ...IMAGES.food][index % 13];
    batch.set(db.collection('news').doc(`demo_news_${String(index + 1).padStart(2, '0')}`), demo({
      title,
      text: `Короткая демонстрационная новость для живой ленты АПГ. Рассказываем о городских проектах, партнёрах, мероприятиях и возможностях для жителей Зеленограда.\n\nОткройте приложение, выберите интересное место или событие и собирайте ключи за активность.`,
      emoji: ['🗞️', '✨', '🤝', '🎉', '🎁'][index % 5],
      imageUrl: image,
      coverPhoto: image,
      category: ['city', 'partners', 'culture', 'sport', 'family'][index % 5],
      publishedAt: ts(day(-index).toISOString()),
      linkUrl: 'https://myapg.ru',
      linkLabel: 'Подробнее',
      priority: Math.max(0, 10 - (index % 10)),
      createdAt: FieldValue.serverTimestamp(),
      linksCheckedAt: FieldValue.serverTimestamp(),
    }));
  });

  eventTitles.forEach(([title, emoji, category, offset, hour], index) => {
    const start = day(offset);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const image = IMAGES.events[index % IMAGES.events.length];
    const partner = partners[index % partners.length];
    batch.set(db.collection('events').doc(`demo_event_${String(index + 1).padStart(2, '0')}`), demo({
      title,
      emoji,
      category,
      description: `Демонстрационное мероприятие АПГ для афиши города. Участники знакомятся с партнёрами, экспертами и городскими инициативами.`,
      date: `${dateLabel(start)}, ${timeLabel(hour)}`,
      startAt: ts(start.toISOString()),
      endAt: ts(end.toISOString()),
      partner: partner[1],
      partnerId: partner[0],
      address: `Зеленоград, корпус ${200 + index * 7}`,
      location: index % 3 === 0 ? 'Парк Победы' : index % 3 === 1 ? 'Городское пространство АПГ' : partner[1],
      imageUrl: image,
      coverPhoto: image,
      linkUrl: 'https://myapg.ru',
      linkLabel: 'Записаться',
      socialUrl: 'https://vk.com',
      isPrivate: index === 19 || index === 0,
      minKeys: index === 19 ? 25 : index === 0 ? 10 : 0,
      maxParticipants: 25 + index * 3,
      registeredCount: 4 + index,
      isExpertEvent: index % 5 === 0,
      priceClub: index % 5 === 0 ? '900 ₽' : '',
      pricePublic: index % 5 === 0 ? '1500 ₽' : '',
      priority: Math.max(0, 10 - (index % 10)),
      createdAt: FieldValue.serverTimestamp(),
      linksCheckedAt: FieldValue.serverTimestamp(),
    }));
  });

  prizes.forEach(([name, emoji, type, cost, stock, partnerId], index) => {
    batch.set(db.collection('prizes').doc(`demo_prize_${String(index + 1).padStart(2, '0')}`), demo({
      name,
      emoji,
      type,
      cost,
      ticketCost: type === 'raffle' ? cost : null,
      stock: type === 'fixed' ? stock : null,
      description: type === 'raffle' ? 'Демонстрационный розыгрыш для участников АПГ.' : 'Демонстрационный подарок, который можно получить за ключи.',
      partnerId,
      expertId: null,
      active: true,
      imageUrl: IMAGES.rewards[index % IMAGES.rewards.length],
      raffleDate: type === 'raffle' ? ts(day(14 + index).toISOString()) : null,
      createdAt: FieldValue.serverTimestamp(),
    }));
  });

  tasks.forEach(([id, title, description, emoji, reward], index) => {
    batch.set(db.collection('customTasks').doc(`demo_task_${id}`), demo({
      title, description, emoji, reward,
      active: true,
      priority: index + 1,
      createdAt: FieldValue.serverTimestamp(),
    }));
  });

  partners.slice(0, 5).forEach((partner, index) => {
    batch.set(db.collection('banners').doc(`demo_banner_${index + 1}`), demo({
      title: ['Большой городской нетворкинг', 'Кофейный маршрут недели', 'Подарки за ключи', 'Йога в парке', 'Семейные выходные'][index],
      imageUrl: [IMAGES.events[0], IMAGES.food[0], IMAGES.rewards[0], IMAGES.sport[0], IMAGES.events[2]][index],
      advertiserType: 'partner',
      advertiserId: partner[0],
      advertiserName: partner[1],
      linkType: 'internal_partner',
      linkValue: partner[0],
      startDate: ts(day(-1).toISOString()),
      endDate: ts(day(30 + index).toISOString()),
      priority: index + 1,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    }));
  });

  await batch.commit();

  const reviewBatch = db.batch();
  partners.forEach((partner, index) => {
    users.slice(0, 4).forEach(([userId, name, , photo], userIndex) => {
      reviewBatch.set(db.collection('partners').doc(partner[0]).collection('reviews').doc(`${userId}_${index}`), demo({
        rating: 5 - ((index + userIndex) % 2),
        text: ['Очень приятное место, видно, что партнёр АПГ реально старается.', 'Зашли по рекомендации из приложения и остались довольны.', 'Удобно, красиво, бонусы по ключам работают понятно.', 'Хороший сервис и внимательное отношение.'][userIndex],
        authorId: userId,
        authorName: name,
        authorPhoto: photo,
        likes: 2 + userIndex + index,
        createdAt: FieldValue.serverTimestamp(),
      }));
    });
  });
  experts.forEach((expert, index) => {
    users.slice(4, 8).forEach(([userId, name, , photo], userIndex) => {
      reviewBatch.set(db.collection('expertReviews').doc(`demo_expert_review_${index}_${userIndex}`), demo({
        expertId: expert[0],
        rating: 5,
        text: ['Консультация помогла быстро разложить всё по полочкам.', 'Очень спокойно и по делу, буду рекомендовать.', 'Получил понятный план действий после встречи.', 'Классный эксперт, много практики без воды.'][userIndex],
        authorId: userId,
        authorName: name,
        authorPhoto: photo,
        likes: 1 + userIndex,
        createdAt: FieldValue.serverTimestamp(),
      }));
    });
  });
  users.forEach(([userId, name], index) => {
    for (let i = 0; i < 3; i += 1) {
      reviewBatch.set(db.collection('users').doc(userId).collection('activity').doc(`demo_activity_${i}`), demo({
        type: ['scan', 'task', 'prize'][i],
        icon: ['🗝️', '✅', '🎁'][i],
        text: [`${name} получил ключ у партнёра`, `${name} выполнил городское задание`, `${name} участвует в розыгрыше`][i],
        keys: i === 2 ? -2 : 1 + i,
        ts: FieldValue.serverTimestamp(),
        partnerId: partners[(index + i) % partners.length][0],
      }));
    }
  });
  await reviewBatch.commit();

  return {
    cleared,
    created: {
      partners: partners.length,
      experts: experts.length,
      users: users.length,
      news: newsTitles.length,
      events: eventTitles.length,
      prizes: prizes.length,
      banners: 5,
      customTasks: tasks.length,
      partnerReviews: partners.length * 4,
      expertReviews: experts.length * 4,
      userActivity: users.length * 3,
    },
  };
}

const mode = process.argv.includes('--clear') ? 'clear' : 'seed';
const result = mode === 'clear' ? await clearDemo() : await seedDemo();
console.log(JSON.stringify({ ok: true, mode, emulator: process.env.FIRESTORE_EMULATOR_HOST, ...result }, null, 2));
