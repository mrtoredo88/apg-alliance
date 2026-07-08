import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from './constants.js';
import { uploadPhoto } from './utils/uploadPhoto.js';
import { normalizeExternalUrl } from './utils/externalUrls.js';

const TYPES = {
  partner: { label: 'партнёра', title: 'Анкета партнёра', emoji: '🤝' },
  expert: { label: 'эксперта', title: 'Анкета эксперта', emoji: '🧑‍💼' },
  event: { label: 'события', title: 'Анкета события', emoji: '🎉' },
  news: { label: 'новости', title: 'Заявка на новость', emoji: '📢' },
  prize: { label: 'приза', title: 'Анкета приза', emoji: '🎁' },
};

const COMMON_FIELDS = [
  ['contactName', 'Ваше имя', 'text', 'Как к вам обращаться'],
  ['phone', 'Телефон', 'tel', '+7'],
  ['email', 'Email', 'email', 'mail@example.ru'],
  ['website', 'Сайт / запись', 'url', 'site.ru'],
  ['vk', 'VK', 'text', 'vk.com/name или @name'],
  ['telegram', 'Telegram', 'text', '@name'],
];

const FIELDS = {
  partner: [
    ['title', 'Название компании', 'text', 'Например, Vibes'],
    ['category', 'Категория', 'text', 'Красота, еда, спорт...'],
    ['shortDescription', 'Короткое описание', 'textarea', '1-2 предложения'],
    ['description', 'Подробное описание', 'textarea', 'Что вы делаете и чем полезны жителям'],
    ['address', 'Адрес', 'text', 'Зеленоград, корпус...'],
    ['hours', 'График работы', 'text', 'Пн-Пт 10:00-20:00'],
    ['offer', 'Акция для пользователей АПГ', 'textarea', 'Скидка, подарок или бонус'],
    ['gift', 'Подарок / бонус за ключи', 'textarea', 'Что пользователь может получить'],
    ['services', 'Услуги', 'textarea', 'Основные услуги или направления'],
    ...COMMON_FIELDS,
    ['comment', 'Комментарий', 'textarea', 'Что ещё важно знать редактору'],
  ],
  expert: [
    ['title', 'Имя и фамилия', 'text', 'Иван Иванов'],
    ['category', 'Направление', 'text', 'Психология, здоровье, обучение...'],
    ['shortDescription', 'Коротко о себе', 'textarea', '1-2 предложения'],
    ['description', 'Подробно о себе', 'textarea', 'Опыт, подход, чем помогаете'],
    ['services', 'Услуги / форматы работы', 'textarea', 'Консультации, группы, онлайн...'],
    ['cost', 'Стоимость / условия', 'text', 'Если можно указывать публично'],
    ['offer', 'Акция для пользователей АПГ', 'textarea', 'Скидка, бонус, бесплатная встреча'],
    ...COMMON_FIELDS,
    ['comment', 'Комментарий', 'textarea', 'Что ещё важно знать редактору'],
  ],
  event: [
    ['title', 'Название события', 'text', 'Мастер-класс, встреча, лекция...'],
    ['date', 'Дата и время', 'text', '12 июля, 18:00'],
    ['location', 'Место проведения', 'text', 'Адрес или площадка'],
    ['category', 'Категория', 'text', 'Дети, культура, спорт...'],
    ['shortDescription', 'Короткий анонс', 'textarea', '1-2 предложения'],
    ['description', 'Описание события', 'textarea', 'Что будет происходить'],
    ['program', 'Программа', 'textarea', 'План, тайминг, активности'],
    ['cost', 'Стоимость', 'text', 'Бесплатно / цена'],
    ['organizer', 'Организатор', 'text', 'Кто проводит'],
    ...COMMON_FIELDS,
  ],
  news: [
    ['title', 'Заголовок', 'text', 'Главная мысль новости'],
    ['shortDescription', 'Короткий анонс', 'textarea', '1-2 предложения'],
    ['description', 'Текст новости', 'textarea', 'Факты, детали, цитаты'],
    ['category', 'Категория', 'text', 'АПГ, город, партнёры...'],
    ['source', 'Источник', 'text', 'Откуда информация'],
    ['website', 'Ссылка на источник', 'url', 'https://...'],
    ['comment', 'Комментарий редактору', 'textarea', 'Что проверить перед публикацией'],
  ],
  prize: [
    ['title', 'Название приза', 'text', 'Что разыгрываем'],
    ['provider', 'Кто предоставляет', 'text', 'Партнёр, эксперт или АПГ'],
    ['description', 'Описание приза', 'textarea', 'Что входит, ценность, детали'],
    ['conditions', 'Условия участия', 'textarea', 'Как получить или участвовать'],
    ['date', 'Дата розыгрыша', 'text', 'Если известна'],
    ['cost', 'Количество / номинал', 'text', '1 шт, сертификат 3000 ₽...'],
    ...COMMON_FIELDS,
  ],
};

const S = {
  page: { minHeight: '100svh', background: 'linear-gradient(180deg,#f4f1e9 0%,#eceff5 52%,#f8f7f2 100%)', color: '#191713', fontFamily: 'Manrope, system-ui, -apple-system, sans-serif', padding: 'calc(18px + env(safe-area-inset-top,0px)) 14px calc(34px + env(safe-area-inset-bottom,0px))' },
  wrap: { width: '100%', maxWidth: 760, margin: '0 auto' },
  card: { background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(36,32,24,0.10)', borderRadius: 26, boxShadow: '0 22px 80px rgba(31,28,18,0.12)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: 18 },
  label: { display: 'block', fontSize: 12, lineHeight: '16px', fontWeight: 850, color: 'rgba(25,23,19,0.62)', margin: '14px 0 7px' },
  input: { width: '100%', minHeight: 48, border: '1px solid rgba(25,23,19,0.12)', borderRadius: 16, background: 'rgba(255,255,255,0.72)', color: '#191713', font: 'inherit', fontSize: 16, outline: 'none', padding: '0 14px', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 104, border: '1px solid rgba(25,23,19,0.12)', borderRadius: 16, background: 'rgba(255,255,255,0.72)', color: '#191713', font: 'inherit', fontSize: 16, outline: 'none', padding: 14, boxSizing: 'border-box', resize: 'vertical', lineHeight: '22px' },
  button: { minHeight: 50, border: 'none', borderRadius: 17, background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#17120a', fontSize: 15, fontWeight: 900, padding: '0 18px', cursor: 'pointer', boxShadow: '0 12px 34px rgba(201,168,76,0.30)' },
  ghost: { minHeight: 44, border: '1px solid rgba(25,23,19,0.12)', borderRadius: 15, background: 'rgba(255,255,255,0.58)', color: '#191713', fontSize: 14, fontWeight: 820, padding: '0 14px', cursor: 'pointer' },
};

function readSubmitRoute() {
  const raw = window.location.hash.startsWith('#/submit/')
    ? window.location.hash.replace(/^#/, '')
    : window.location.pathname;
  const match = raw.match(/^\/submit\/([^/]+)\/([^/?#]+)/);
  return match ? { type: match[1], token: match[2] } : null;
}

function PublicField({ field, value, onChange }) {
  const [name, label, kind, placeholder] = field;
  const inputStyle = kind === 'textarea' ? S.textarea : S.input;
  return (
    <label>
      <span style={S.label}>{label}</span>
      {kind === 'textarea' ? (
        <textarea value={value || ''} onChange={e => onChange(name, e.target.value)} placeholder={placeholder} style={inputStyle} />
      ) : (
        <input value={value || ''} onChange={e => onChange(name, e.target.value)} type={kind} placeholder={placeholder} style={inputStyle} />
      )}
    </label>
  );
}

export function PublicSubmitPage() {
  const route = useMemo(readSubmitRoute, []);
  const [formInfo, setFormInfo] = useState(null);
  const [fields, setFields] = useState({});
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const type = formInfo?.type || route?.type || 'partner';
  const meta = TYPES[type] || TYPES.partner;
  const formFields = FIELDS[type] || FIELDS.partner;

  useEffect(() => {
    if (!route?.token) {
      setLoading(false);
      setError('Ссылка анкеты некорректна.');
      return;
    }
    setLoading(true);
    fetch(`${API_BASE_URL}/api/public-submit?token=${encodeURIComponent(route.token)}`, {
      headers: { 'X-APG-Version': 'public-submit-v1' },
    })
      .then(res => res.json().then(data => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok || data.ok === false) throw new Error(data.error || 'Форма недоступна.');
        setFormInfo(data);
      })
      .catch(e => setError(e.message || 'Форма недоступна.'))
      .finally(() => setLoading(false));
  }, [route?.token]);

  const setField = (name, value) => {
    setFields(prev => ({ ...prev, [name]: value }));
  };

  const handleFiles = async (list) => {
    const incoming = Array.from(list || []).filter(file => /^image\//.test(file.type)).slice(0, Math.max(0, 8 - files.length));
    if (!incoming.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of incoming) {
        if (file.size > 8 * 1024 * 1024) {
          uploaded.push({ name: file.name, type: file.type, size: file.size, error: 'Файл больше 8 МБ' });
          continue;
        }
        const preview = URL.createObjectURL(file);
        const url = await uploadPhoto(file, `public-submissions/${route.token}`);
        uploaded.push({ name: file.name, type: file.type, size: file.size, url, preview, role: files.length || uploaded.length ? 'photo' : 'main' });
      }
      setFiles(prev => [...prev, ...uploaded]);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить фото.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const title = String(fields.title || '').trim();
    const description = String(fields.description || fields.shortDescription || '').trim();
    if (!title || !description) {
      setError('Заполните название и описание. Остальное можно уточнить позже.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const normalizedFields = {
        ...fields,
        website: normalizeExternalUrl(fields.website || fields.bookingUrl),
        vk: normalizeExternalUrl(fields.vk, { platform: 'vk' }),
        telegram: normalizeExternalUrl(fields.telegram, { platform: 'telegram' }),
      };
      const res = await fetch(`${API_BASE_URL}/api/public-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APG-Version': 'public-submit-v1' },
        body: JSON.stringify({
          token: route.token,
          fields: normalizedFields,
          files: files.filter(file => file.url).map(({ name, type, size, url, role }) => ({ name, type, size, url, role })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Не удалось отправить заявку.');
      setDone(data);
    } catch (e) {
      setError(e.message || 'Не удалось отправить заявку.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={S.page}><div style={S.wrap}><div style={S.card}>Загружаем анкету...</div></div></div>;
  }

  if (error && !formInfo) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{ ...S.card, textAlign: 'center', marginTop: 40 }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Форма недоступна</h1>
            <p style={{ color: 'rgba(25,23,19,0.58)', lineHeight: '22px' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{ ...S.card, textAlign: 'center', marginTop: 40, padding: 26 }}>
            <div style={{ fontSize: 54, marginBottom: 12 }}>✅</div>
            <h1 style={{ margin: 0, fontSize: 27 }}>Заявка отправлена</h1>
            <p style={{ color: 'rgba(25,23,19,0.62)', lineHeight: '23px' }}>
              Спасибо! Информация уже попала в систему АПГ. Локи подготовил черновик, редактор проверит его перед публикацией.
            </p>
            {done.missingFields?.length > 0 && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 18, background: 'rgba(201,168,76,0.13)', color: '#6b5316', fontSize: 13, lineHeight: '20px', textAlign: 'left' }}>
                Для публикации желательно уточнить: {done.missingFields.join(', ')}.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <img src="/logo.png" alt="АПГ" style={{ width: 46, height: 46, borderRadius: 16, objectFit: 'cover', boxShadow: '0 12px 28px rgba(0,0,0,0.12)' }} />
          <div>
            <div style={{ fontSize: 13, color: 'rgba(25,23,19,0.54)', fontWeight: 850 }}>Альянс Партнёров Города</div>
            <div style={{ fontSize: 18, color: '#191713', fontWeight: 950 }}>Публичная анкета</div>
          </div>
        </div>

        <div style={{ ...S.card, marginBottom: 14, padding: 22 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>{meta.emoji}</div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: '34px', fontWeight: 950 }}>{meta.title}</h1>
          <p style={{ margin: '12px 0 0', color: 'rgba(25,23,19,0.62)', fontSize: 15, lineHeight: '23px' }}>
            Спасибо за интерес к проекту! Заполните небольшую анкету для {meta.label}. Это займёт 2-3 минуты.
          </p>
        </div>

        <div style={S.card}>
          {formFields.map(field => (
            <PublicField key={field[0]} field={field} value={fields[field[0]]} onChange={setField} />
          ))}

          <span style={S.label}>Фотографии и логотип</span>
          <div
            onDragEnter={e => { e.preventDefault(); setDragActive(true); }}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
            style={{ border: `1px dashed ${dragActive ? '#C9A84C' : 'rgba(25,23,19,0.22)'}`, borderRadius: 20, background: dragActive ? 'rgba(201,168,76,0.14)' : 'rgba(255,255,255,0.46)', padding: 18, textAlign: 'center' }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
            <div style={{ fontSize: 14, fontWeight: 850 }}>Перетащите фото сюда или выберите с телефона</div>
            <div style={{ color: 'rgba(25,23,19,0.54)', fontSize: 12, margin: '6px 0 12px' }}>JPG, PNG, WebP до 8 МБ, максимум 8 файлов</div>
            <input type="file" multiple accept="image/*" capture="environment" onChange={e => handleFiles(e.target.files)} style={{ ...S.input, padding: 10, minHeight: 44 }} />
          </div>

          {files.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 10, marginTop: 12 }}>
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(25,23,19,0.06)', border: '1px solid rgba(25,23,19,0.08)' }}>
                  {file.preview || file.url ? <img src={file.preview || file.url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} /> : null}
                  <div style={{ padding: 8, fontSize: 10, color: file.error ? '#b91c1c' : 'rgba(25,23,19,0.62)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.error || file.name}</div>
                </div>
              ))}
            </div>
          )}

          {error && <div style={{ marginTop: 14, padding: 13, borderRadius: 16, background: 'rgba(220,38,38,0.10)', color: '#b91c1c', fontSize: 13, lineHeight: '19px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" onClick={submit} disabled={submitting || uploading} style={{ ...S.button, opacity: submitting || uploading ? 0.55 : 1 }}>{uploading ? 'Загружаем фото...' : submitting ? 'Отправляем...' : 'Отправить заявку'}</button>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={S.ghost}>Наверх</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function isPublicSubmitRoute() {
  return Boolean(readSubmitRoute());
}
