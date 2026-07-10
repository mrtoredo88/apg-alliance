// Vercel serverless function — расчёт индекса активности партнёров
// Cron: ежедневно в 03:00 UTC (см. vercel.json)
// Ручной запуск из AdminPanel: POST /api/activity-index { secret, forceAward? }
//
// Env:
//   FIREBASE_SERVICE_ACCOUNT — JSON сервисного аккаунта Firebase
//   ACTIVITY_SECRET           — секрет для ручного запуска из AdminPanel
//   CRON_SECRET               — Vercel передаёт автоматически
//
// Требуемые коллекции Firestore:
//   scans/{auto}         { partnerId, userId, isNew, monthKey:'YYYY-MM', scannedAt }
//   partners/{id}        { avgRating, profileUpdatedAt, activityStats, partnerOfMonth }
//   prizes/{auto}        { type:'raffle', partnerId, createdAt }   (partnerId — новое поле)
//   events/{auto}        { partnerId, createdAt }                   (partnerId — новое поле)
//   monthlyWinners/{YYYY-MM} { partnerId, activityIndex, newClients, avgRating, awardedAt }

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let _db = null;
function getDb() {
  if (_db) return _db;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
  _db = getFirestore(getApps()[0]);
  return _db;
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonthKey() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return currentMonthKey(d);
}

// ── Чтение данных ──────────────────────────────────────────────────────────────

async function loadScansForMonth(db, monthKey) {
  const snap = await db.collection('scans').where('monthKey', '==', monthKey).get();
  const byPartner = {};
  for (const d of snap.docs) {
    const { partnerId, isNew } = d.data();
    if (!partnerId) continue;
    if (!byPartner[partnerId]) byPartner[partnerId] = { newClients: 0, totalVisits: 0 };
    byPartner[partnerId].totalVisits++;
    if (isNew) byPartner[partnerId].newClients++;
  }
  return byPartner;
}

async function loadRafflesForMonth(db, monthStart) {
  const snap = await db.collection('prizes')
    .where('type', '==', 'raffle')
    .where('createdAt', '>=', monthStart)
    .get();
  const byPartner = {};
  for (const d of snap.docs) {
    const pid = d.data().partnerId;
    if (pid) byPartner[pid] = (byPartner[pid] ?? 0) + 1;
  }
  return byPartner;
}

async function loadEventsForMonth(db, monthStart) {
  const snap = await db.collection('events').where('createdAt', '>=', monthStart).get();
  const byPartner = {};
  for (const d of snap.docs) {
    const pid = d.data().partnerId;
    if (pid) byPartner[pid] = (byPartner[pid] ?? 0) + 1;
  }
  return byPartner;
}

// ── Расчёт индекса ─────────────────────────────────────────────────────────────

async function calcActivityIndex(db) {
  const now = new Date();
  const monthKey = currentMonthKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [partnersSnap, scansByPartner, rafflesByPartner, eventsByPartner] = await Promise.all([
    db.collection('partners').get(),
    loadScansForMonth(db, monthKey),
    loadRafflesForMonth(db, monthStart),
    loadEventsForMonth(db, monthStart),
  ]);

  const partners = partnersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.archived !== true);

  const rawStats = partners.map(p => {
    const scans = scansByPartner[p.id] ?? { newClients: 0, totalVisits: 0 };
    const profileUpdatedAt = p.profileUpdatedAt?.toDate?.() ?? null;

    return {
      id:              p.id,
      newClients:      scans.newClients,
      returningVisits: Math.max(0, scans.totalVisits - scans.newClients),
      totalVisits:     scans.totalVisits,
      avgRating:       p.avgRating ?? 0,
      profileUpdated:  profileUpdatedAt ? profileUpdatedAt >= thirtyDaysAgo : false,
      rafflesCount:    rafflesByPartner[p.id] ?? 0,
      eventsCount:     eventsByPartner[p.id] ?? 0,
    };
  });

  const maxNewClients  = Math.max(1, ...rawStats.map(s => s.newClients));
  const maxEngagement  = Math.max(1, ...rawStats.map(s => s.rafflesCount + s.eventsCount));

  const results = rawStats.map(s => {
    const newClientsScore  = (s.newClients / maxNewClients) * 30;
    const returningScore   = s.totalVisits > 0 ? (s.returningVisits / s.totalVisits) * 25 : 0;
    const ratingScore      = (s.avgRating / 5) * 20;
    const profileScore     = s.profileUpdated ? 10 : 0;
    const engagementScore  = ((s.rafflesCount + s.eventsCount) / maxEngagement) * 15;
    const activityIndex    = Math.round(
      newClientsScore + returningScore + ratingScore + profileScore + engagementScore,
    );

    return { ...s, activityIndex };
  });

  return { results, monthKey };
}

// ── Запись в Firestore ─────────────────────────────────────────────────────────

async function writeStats(db, results, monthKey) {
  const BATCH_LIMIT = 400;
  for (let i = 0; i < results.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const s of results.slice(i, i + BATCH_LIMIT)) {
      batch.update(db.collection('partners').doc(s.id), {
        activityStats: {
          month:           monthKey,
          newClients:      s.newClients,
          returningVisits: s.returningVisits,
          totalVisits:     s.totalVisits,
          avgRating:       s.avgRating,
          profileUpdated:  s.profileUpdated,
          rafflesCount:    s.rafflesCount,
          eventsCount:     s.eventsCount,
          activityIndex:   s.activityIndex,
        },
      });
    }
    await batch.commit();
  }
}

// ── Определение партнёра месяца (запускается 1-го числа) ──────────────────────

async function handleMonthStart(db) {
  const prev = prevMonthKey();

  // Не присваивать повторно
  const winnerDoc = await db.collection('monthlyWinners').doc(prev).get();
  if (winnerDoc.exists) return { skipped: 'Already awarded for ' + prev };

  // Читаем activityStats, записанные вчера (последний день прошлого месяца)
  const partnersSnap = await db.collection('partners').get();
  const candidates = partnersSnap.docs
    .map(d => ({ id: d.id, archived: d.data().archived, name: d.data().name, ...d.data().activityStats }))
    .filter(s => s.archived !== true)
    .filter(s => s.month === prev && s.activityIndex > 0);

  if (!candidates.length) return { skipped: 'No activity data for ' + prev };

  const best = candidates.reduce((a, b) => (b.activityIndex > a.activityIndex ? b : a));

  const batch = db.batch();

  // Запись победителя
  batch.set(db.collection('monthlyWinners').doc(prev), {
    partnerId:     best.id,
    partnerName:   best.name ?? '',
    activityIndex: best.activityIndex,
    newClients:    best.newClients ?? 0,
    avgRating:     best.avgRating ?? 0,
    awardedAt:     FieldValue.serverTimestamp(),
  });

  // Снимаем флаг с предыдущего победителя
  const prevWinnersSnap = await db.collection('partners').where('partnerOfMonth', '==', true).get();
  for (const d of prevWinnersSnap.docs) {
    batch.update(d.ref, { partnerOfMonth: false });
  }

  // Устанавливаем нового победителя
  batch.update(db.collection('partners').doc(best.id), { partnerOfMonth: true });

  await batch.commit();

  // Push-уведомление (broadcast)
  await db.collection('notifications').add({
    targetUserId: null,
    title:        `🏆 ${best.name ?? 'Партнёр'} — партнёр месяца!`,
    body:         `${best.newClients ?? 0} новых клиентов, рейтинг ${(best.avgRating ?? 0).toFixed(1)} ⭐. Загляни и узнай почему`,
    emoji:        '🏆',
    partnerId:    best.id,
    type:         'partnerOfMonth',
    createdAt:    FieldValue.serverTimestamp(),
  });

  return { winner: best.id, winnerName: best.name, activityIndex: best.activityIndex };
}

// ── Обработчик запроса ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    const cronAuth  = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
    const adminAuth = req.method === 'POST' && req.body?.secret === process.env.ACTIVITY_SECRET;
    if (!cronAuth && !adminAuth) return res.status(403).json({ error: 'Forbidden' });

    let db;
    try { db = getDb(); } catch (e) { return res.status(500).json({ error: e.message }); }

    const today = new Date();
    const isFirstOfMonth = today.getDate() === 1;

    // 1-го числа: сначала присваиваем победителя (до перезаписи stats)
    let monthStartResult = null;
    if (isFirstOfMonth || req.body?.forceAward) {
      monthStartResult = await handleMonthStart(db);
    }

    // Пересчёт и запись индексов
    const { results, monthKey } = await calcActivityIndex(db);
    await writeStats(db, results, monthKey);

    const top3 = [...results]
      .sort((a, b) => b.activityIndex - a.activityIndex)
      .slice(0, 3)
      .map(s => ({ id: s.id, activityIndex: s.activityIndex, newClients: s.newClients }));

    return res.status(200).json({ updated: results.length, month: monthKey, top3, monthStart: monthStartResult });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 500) });
  }
}
