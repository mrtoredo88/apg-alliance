import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from './constants.js';
import { GLASS, GLASS_GOLD, T } from './design.js';
import { uploadPhoto } from './utils/uploadPhoto.js';
import { normalizeExternalUrl } from './utils/externalUrls.js';
import { ExpertQuestionnaire } from './components/ExpertQuestionnaire.jsx';
import { PartnerQuestionnaire } from './components/PartnerQuestionnaire.jsx';
import { TariffOptionCard } from './components/TariffOptionCard.jsx';
import { EXPERT_TARIFFS, PARTNER_TARIFFS, hasExpertAmbassadorAccess, hasPartnerPremiumAccess, normalizeExpertTariff, normalizePartnerTariff } from './tariffConfig.js';

const STORAGE_KEY = 'apg_partnership_flow_v1';

const LOKI_ANSWERS = [
  {
    q: 'Что даёт участие?',
    a: 'Бизнес получает карточку в АПГ, спецпредложение для жителей, контакты, фото и путь к продвижению через новости или мероприятия на старших тарифах. Пользователь получает понятные места, бонусы и причины возвращаться.',
  },
  {
    q: 'Что лучше выбрать?',
    a: 'Если вы продвигаете компанию, студию, кафе, сервис или бренд — выбирайте партнёра. Если продвигаете личную практику, консультации, экспертизу или наставничество — выбирайте эксперта.',
  },
  {
    q: 'Чем отличается партнёр от эксперта?',
    a: 'Партнёр — это бизнес-карточка с акциями, адресом, контактами, событиями и новостями. Эксперт — личный профиль специалиста с услугами, аудиторией, записью и экспертным контентом.',
  },
  {
    q: 'Как работают ключи?',
    a: 'Пользователь сканирует QR у партнёра и получает ключи за визит. Для партнёра это аккуратный способ видеть интерес аудитории и возвращаемость без лишней сложности.',
  },
  {
    q: 'Как происходит подключение?',
    a: 'Сначала заявка, затем проверка администрацией. Если всё в порядке, карточку можно подготовить через ИИ-импорт и опубликовать в каталоге.',
  },
  {
    q: 'Сколько занимает проверка?',
    a: 'Обычно проверка зависит от полноты анкеты и материалов. Чем понятнее описание, контакты, фото и предложение для пользователей АПГ, тем быстрее администратор сможет подготовить карточку.',
  },
  {
    q: 'Что делать после отправки заявки?',
    a: 'Дождитесь проверки. Администрация посмотрит данные, при необходимости уточнит детали и подготовит карточку к публикации или подключению кабинета.',
  },
  {
    q: 'Какой тариф выбрать?',
    a: 'Если нужна базовая карточка — Старт или Практика. Если важны запись, галерея и видео — Альянс. Если нужны новости, мероприятия и расширенная работа с АПГ — Премиум или Амбассадор.',
  },
  {
    q: 'Какие требования?',
    a: 'Нужны реальные контакты, понятное описание, корректное предложение для пользователей АПГ и материалы, которые можно безопасно показать в приложении.',
  },
  {
    q: 'Что входит в тариф?',
    a: 'Карточки ниже показывают доступные возможности. Анкета дальше автоматически скроет поля, которые не относятся к выбранному тарифу.',
  },
];

function buttonStyle(kind = 'gold') {
  const gold = kind === 'gold';
  return {
    border: gold ? `1px solid ${T.gold}` : `1px solid ${T.border}`,
    background: gold ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})` : T.surface,
    color: gold ? '#191713' : T.textPri,
    borderRadius: 18,
    padding: '13px 16px',
    minHeight: 48,
    fontSize: 14,
    fontWeight: 900,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: gold ? '0 14px 32px rgba(201,168,76,0.22)' : 'none',
  };
}

function StepProgress({ current }) {
  const steps = ['Ознакомление', 'Выбор направления', 'Заполнение анкеты', 'Проверка заявки', 'Подключение'];
  const marks = ['①', '②', '③', '④', '⑤'];
  return (
    <div style={{ ...GLASS, borderRadius: 22, padding: 13, display: 'grid', gap: 9 }}>
      {steps.map((label, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: done || active ? 1 : 0.58 }}>
            <div style={{
              width: 27, height: 27, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done || active ? `color-mix(in srgb, ${T.gold} 24%, transparent)` : T.surface2,
              border: `1px solid ${done || active ? T.gold : T.border}`,
              color: done || active ? T.gold : T.textSec,
              fontSize: 12, fontWeight: 950,
            }}>
              {done ? '✓' : marks[index]}
            </div>
            <div style={{ color: active ? T.textPri : T.textSec, fontSize: 12.5, lineHeight: '17px', fontWeight: active ? 900 : 700 }}>{label}</div>
          </div>
        );
      })}
    </div>
  );
}

function InfoCard({ icon, title, text }) {
  return (
    <div style={{ ...GLASS, borderRadius: 22, padding: 16 }}>
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <div style={{ color: T.textPri, fontSize: 16, lineHeight: '21px', fontWeight: 950 }}>{title}</div>
      <div style={{ color: T.textSec, fontSize: 13, lineHeight: '20px', marginTop: 7 }}>{text}</div>
    </div>
  );
}

function LokiHelp({ open, onToggle }) {
  const [active, setActive] = useState(LOKI_ANSWERS[0].q);
  const answer = LOKI_ANSWERS.find(item => item.q === active) || LOKI_ANSWERS[0];
  return (
    <div style={{ ...GLASS_GOLD, borderRadius: 24, padding: 15 }}>
      <button type="button" onClick={onToggle} style={{ width: '100%', border: 0, background: 'transparent', padding: 0, textAlign: 'left', color: T.textPri, fontFamily: 'inherit', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 17, background: `color-mix(in srgb, ${T.gold} 20%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💬</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.textPri, fontSize: 15, fontWeight: 950 }}>Задать вопрос Локи</div>
            <div style={{ color: T.textSec, fontSize: 12, lineHeight: '17px', marginTop: 2 }}>Поможет понять тариф и требования без открытия отдельного чата.</div>
          </div>
          <div style={{ color: T.gold, fontWeight: 950 }}>{open ? '−' : '+'}</div>
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 13 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {LOKI_ANSWERS.map(item => (
              <button key={item.q} type="button" onClick={() => setActive(item.q)} style={{
                border: `1px solid ${active === item.q ? T.gold : T.border}`,
                background: active === item.q ? `color-mix(in srgb, ${T.gold} 18%, transparent)` : T.surface,
                color: active === item.q ? T.textPri : T.textSec,
                borderRadius: 999,
                padding: '8px 10px',
                fontSize: 11.5,
                fontWeight: 850,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}>{item.q}</button>
            ))}
          </div>
          <div style={{ marginTop: 12, color: T.textPri, fontSize: 13, lineHeight: '20px' }}>{answer.a}</div>
        </div>
      )}
    </div>
  );
}

function emptyFields(type, tariff) {
  return type === 'expert'
    ? { tariff, categories: [], audienceTags: [], workFormats: [], videos: [], otherSocials: [] }
    : { tariff, category: 'other', secondaryCategories: [], formats: [], videos: [], otherSocials: [] };
}

function normalizeForSubmit(type, fields) {
  return {
    ...fields,
    title: type === 'expert' ? [fields.lastName, fields.firstName, fields.middleName].filter(Boolean).join(' ') : fields.title,
    category: type === 'expert' ? fields.categories?.[0] || '' : fields.category,
    secondaryCategories: type === 'expert' ? (fields.categories || []).slice(1) : fields.secondaryCategories,
    tariff: type === 'expert' ? normalizeExpertTariff(fields.tariff) : normalizePartnerTariff(fields.tariff),
    website: normalizeExternalUrl(fields.website),
    bookingUrl: normalizeExternalUrl(fields.bookingUrl),
    vk: normalizeExternalUrl(fields.vk, { platform: 'vk' }),
    telegram: normalizeExternalUrl(fields.telegram, { platform: 'telegram' }),
    max: normalizeExternalUrl(fields.max),
    otherSocials: (fields.otherSocials || []).map(value => normalizeExternalUrl(value)).filter(Boolean),
  };
}

function presentationConfig(type) {
  if (type === 'expert') {
    return {
      eyebrow: 'Программа для экспертов',
      title: 'Станьте экспертом АПГ',
      intro: 'Расскажите о своей практике, услугах и аудитории, получайте доверие жителей и развивайте личный экспертный профиль внутри городской платформы.',
      cards: [
        ['🧑‍💼', 'Публичный профиль', 'ФИО, направления, описание, фото, видео и понятная запись для жителей.'],
        ['🎯', 'Точная аудитория', 'Теги “кому могу помочь” позже используются рекомендациями Локи и подборками.'],
        ['📚', 'Контент и события', 'На тарифе Амбассадор доступны новости, мероприятия и расширенное присутствие.'],
        ['✅', 'Проверенное подключение', 'Заявка проходит модерацию, чтобы карточка выглядела профессионально и вызывала доверие.'],
      ],
      tariffsTitle: 'Тарифы для экспертов',
      tariffsSubtitle: 'Практика — профиль и услуги. Амбассадор — расширенный формат с контентом, мероприятиями и юридическим блоком.',
      tariffs: EXPERT_TARIFFS,
    };
  }
  return {
    eyebrow: 'Программа для партнёров',
    title: 'Подключите бизнес к АПГ',
    intro: 'Получайте новых клиентов, запускайте акции, участвуйте в городских событиях и превращайте карточку бизнеса в рабочий канал коммуникации с жителями.',
    cards: [
      ['📈', 'Новые клиенты', 'Карточка, акции, контакты и запись помогают жителям быстрее выбрать ваш бизнес.'],
      ['🗝️', 'Ключи и визиты', 'Пользователь сканирует QR у партнёра, получает ключи, возвращается и повышает свой уровень в АПГ.'],
      ['📰', 'Новости и мероприятия', 'На старших тарифах можно публиковать новости, события и создавать поводы для повторных визитов.'],
      ['🤝', 'Городское сообщество', 'АПГ объединяет локальный бизнес, экспертов и жителей в одной понятной экосистеме.'],
    ],
    tariffsTitle: 'Тарифы для бизнеса',
    tariffsSubtitle: 'Старт — базовая карточка. Альянс — галерея, запись и видео. Премиум — новости, мероприятия и юридический профиль.',
    tariffs: PARTNER_TARIFFS,
  };
}

export function PartnershipPage({ user, initialType = '', entryNonce = 0, onBack, onHome }) {
  const [step, setStep] = useState('info');
  const [selectedType, setSelectedType] = useState('');
  const [infoTariff, setInfoTariff] = useState({ partner: 'start', expert: 'practice' });
  const [fields, setFields] = useState({});
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState('');
  const [lokiOpen, setLokiOpen] = useState(false);

  useEffect(() => {
    if (['partner', 'expert'].includes(initialType)) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved && typeof saved === 'object') {
        if (saved.step) setStep(saved.step);
        if (saved.selectedType) setSelectedType(saved.selectedType);
        if (saved.infoTariff) setInfoTariff(prev => ({ ...prev, ...saved.infoTariff }));
        if (saved.fields) setFields(saved.fields);
        if (Array.isArray(saved.files)) setFiles(saved.files);
      }
    } catch {}
    trackEvent('partnership_page_opened');
  }, []);

  useEffect(() => {
    if (!['partner', 'expert'].includes(initialType)) return;
    localStorage.removeItem(STORAGE_KEY);
    setSelectedType(initialType);
    setFields({});
    setFiles([]);
    setError('');
    setRequestId('');
    setStep('info');
    trackEvent(initialType === 'expert' ? 'partnership_expert_selected' : 'partnership_partner_selected', { surface: 'profile_card' });
    trackEvent('partnership_presentation_opened', { type: initialType });
  }, [initialType, entryNonce]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, selectedType, infoTariff, fields, files: files.filter(file => file.url) }));
    } catch {}
  }, [step, selectedType, infoTariff, fields, files]);

  const currentProgress = step === 'info' ? 1 : step === 'choose' ? 2 : step === 'form' ? 3 : step === 'done' ? 5 : 1;
  const typeLabel = selectedType === 'expert' ? 'Эксперт' : 'Бизнес';
  const tariffs = selectedType === 'expert' ? EXPERT_TARIFFS : PARTNER_TARIFFS;
  const presentation = presentationConfig(selectedType);

  function trackEvent(event, payload = {}) {
    fetch(`${API_BASE_URL}/api/public-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-APG-Version': 'partnership-flow-v1' },
      body: JSON.stringify({
        action: 'track-partnership',
        event,
        payload,
        user: user ? { id: user.id, name: user.displayName || [user.first_name, user.last_name].filter(Boolean).join(' '), email: user.email || user.linkedEmail || '' } : null,
      }),
    }).catch(() => {});
  }

  const selectInfoTariff = (type, tariff) => {
    setInfoTariff(prev => ({ ...prev, [type]: tariff }));
    trackEvent('partnership_tariff_selected', { type, tariff, surface: 'info' });
  };

  const startForm = (type) => {
    const tariff = infoTariff[type] || (type === 'expert' ? 'practice' : 'start');
    setSelectedType(type);
    setFields(emptyFields(type, tariff));
    setFiles([]);
    setError('');
    setStep('form');
    trackEvent('partnership_questionnaire_started', { type, tariff });
  };

  const selectDirection = (type) => {
    setSelectedType(type);
    setFields({});
    setFiles([]);
    setError('');
    setStep('info');
    trackEvent(type === 'expert' ? 'partnership_expert_selected' : 'partnership_partner_selected', { surface: 'choice_screen' });
    trackEvent('partnership_presentation_opened', { type });
  };

  const setField = (name, value) => {
    setFields(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'tariff') trackEvent('partnership_tariff_selected', { type: selectedType, tariff: value, surface: 'form' });
      return next;
    });
  };

  const handleFiles = async (list, role = '') => {
    const replacingSingle = ['avatar', 'logo', 'cover', 'main'].includes(role);
    const existing = replacingSingle ? files.filter(file => file.role !== role) : files;
    const incoming = Array.from(list || []).filter(file => /^image\//.test(file.type)).slice(0, replacingSingle ? 1 : Math.max(0, 12 - existing.length));
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
        const folder = `partnership-applications/${user?.id || 'guest'}`;
        const url = await uploadPhoto(file, folder);
        uploaded.push({ name: file.name, type: file.type, size: file.size, url, preview, role: role || (files.length || uploaded.length ? 'photo' : 'main') });
      }
      setFiles(prev => replacingSingle ? [...prev.filter(file => file.role !== role), ...uploaded] : [...prev, ...uploaded]);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить фото.');
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    if (selectedType === 'expert') {
      const required = [['lastName', 'фамилию'], ['firstName', 'имя'], ['shortDescription', 'короткое описание'], ['contactName', 'контактное лицо'], ['phone', 'телефон'], ['email', 'email']];
      const missing = required.filter(([key]) => !String(fields[key] || '').trim()).map(([, label]) => label);
      if (!Array.isArray(fields.categories) || !fields.categories.length) missing.push('направление деятельности');
      if (missing.length) { setError(`Заполните обязательные поля: ${missing.join(', ')}.`); return false; }
      if (!/^\+?[\d\s()-]{10,20}$/.test(String(fields.phone))) { setError('Проверьте номер телефона.'); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields.email))) { setError('Проверьте email.'); return false; }
      if (hasExpertAmbassadorAccess(fields.tariff) && fields.inn && !/^\d{10}$|^\d{12}$/.test(String(fields.inn).replace(/\D/g, ''))) { setError('ИНН должен содержать 10 или 12 цифр.'); return false; }
    } else {
      const required = [['title', 'название'], ['category', 'категорию'], ['shortDescription', 'короткое описание'], ['description', 'описание'], ['contactName', 'контактное лицо'], ['phone', 'телефон'], ['email', 'email']];
      const missing = required.filter(([key]) => !String(fields[key] || '').trim()).map(([, label]) => label);
      if (missing.length) { setError(`Заполните обязательные поля: ${missing.join(', ')}.`); return false; }
      if (!/^\+?[\d\s()-]{10,20}$/.test(String(fields.phone))) { setError('Проверьте номер телефона.'); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields.email))) { setError('Проверьте email.'); return false; }
      if (hasPartnerPremiumAccess(fields.tariff) && fields.inn && !/^\d{10}$|^\d{12}$/.test(String(fields.inn).replace(/\D/g, ''))) { setError('ИНН должен содержать 10 или 12 цифр.'); return false; }
    }
    setError('');
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError('');
    try {
      const normalizedFields = normalizeForSubmit(selectedType, fields);
      const res = await fetch(`${API_BASE_URL}/api/public-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APG-Version': 'partnership-flow-v1' },
        body: JSON.stringify({
          action: 'partnership-submit',
          type: selectedType,
          fields: normalizedFields,
          files: files.filter(file => file.url).map(({ name, type, size, url, role }) => ({ name, type, size, url, role })),
          user: user ? { id: user.id, name: user.displayName || [user.first_name, user.last_name].filter(Boolean).join(' '), email: user.email || user.linkedEmail || '' } : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Не удалось отправить заявку.');
      setRequestId(data.id || '');
      setStep('done');
      localStorage.removeItem(STORAGE_KEY);
      trackEvent('partnership_application_submitted', { type: selectedType, tariff: normalizedFields.tariff, requestId: data.id });
    } catch (e) {
      setError(e.message || 'Не удалось отправить заявку.');
    } finally {
      setSubmitting(false);
    }
  };

  const formTitle = useMemo(() => {
    const tariff = tariffs.find(item => item.id === fields.tariff);
    return `${typeLabel}: ${tariff?.label || 'тариф выбран'}`;
  }, [fields.tariff, tariffs, typeLabel]);
  const headerTitle = selectedType === 'expert' ? 'Стать экспертом' : selectedType === 'partner' ? 'Стать партнёром' : 'Подключиться к АПГ';

  return (
    <div style={{ minHeight: '100svh', background: T.bg, color: T.textPri, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 14px 88px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={onBack} style={{ ...buttonStyle('plain'), width: 46, padding: 0, borderRadius: 17 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.gold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 950 }}>АПГ подключение</div>
            <div style={{ color: T.textPri, fontSize: 22, lineHeight: '27px', fontWeight: 950 }}>{headerTitle}</div>
          </div>
        </div>

        <StepProgress current={currentProgress} />

        {step === 'info' && (
          <>
            <section style={{ ...GLASS_GOLD, borderRadius: 30, padding: 20, overflow: 'hidden' }}>
              <div style={{ color: T.gold, fontSize: 12, fontWeight: 950, letterSpacing: 1, textTransform: 'uppercase' }}>{presentation.eyebrow}</div>
              <h1 style={{ margin: '8px 0 0', color: T.textPri, fontSize: 30, lineHeight: '34px', fontWeight: 950 }}>{presentation.title}</h1>
              <p style={{ margin: '10px 0 0', color: T.textSec, fontSize: 14, lineHeight: '22px' }}>{presentation.intro}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                {selectedType ? (
                  <button type="button" onClick={() => startForm(selectedType)} style={buttonStyle('gold')}>Продолжить</button>
                ) : (
                  <button type="button" onClick={() => setStep('choose')} style={buttonStyle('gold')}>Выбрать направление</button>
                )}
                <button type="button" onClick={() => setLokiOpen(true)} style={buttonStyle('plain')}>💬 Спросить Локи</button>
              </div>
            </section>

            <LokiHelp open={lokiOpen} onToggle={() => setLokiOpen(prev => !prev)} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              {presentation.cards.map(([icon, title, text]) => <InfoCard key={title} icon={icon} title={title} text={text} />)}
            </div>

            <section style={{ ...GLASS, borderRadius: 26, padding: 16 }}>
              <div style={{ color: T.textPri, fontSize: 18, fontWeight: 950 }}>{presentation.tariffsTitle}</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{presentation.tariffsSubtitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 10, marginTop: 12 }}>
                {presentation.tariffs.map(item => <TariffOptionCard key={item.id} item={item} selected={infoTariff[selectedType || 'partner'] === item.id} onSelect={(id) => selectInfoTariff(selectedType || 'partner', id)} />)}
              </div>
            </section>
          </>
        )}

        {step === 'choose' && (
          <section style={{ ...GLASS, borderRadius: 28, padding: 18 }}>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 950, letterSpacing: 1, textTransform: 'uppercase' }}>Шаг 2</div>
            <h2 style={{ margin: '8px 0 6px', color: T.textPri, fontSize: 24, lineHeight: '29px', fontWeight: 950 }}>Выберите направление</h2>
            <div style={{ color: T.textSec, fontSize: 13, lineHeight: '20px' }}>После выбора откроется короткая анкета ИИ-импорта с полями только для выбранного типа и тарифа.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12, marginTop: 15 }}>
              <button type="button" onClick={() => selectDirection('partner')} style={{ ...GLASS_GOLD, borderRadius: 22, padding: 16, textAlign: 'left', cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>
                <div style={{ fontSize: 28 }}>🏪</div>
                <div style={{ marginTop: 10, fontSize: 18, fontWeight: 950 }}>Бизнес</div>
                <div style={{ marginTop: 6, color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Компания, студия, кафе, сервис или локальный бренд.</div>
              </button>
              <button type="button" onClick={() => selectDirection('expert')} style={{ ...GLASS, borderRadius: 22, padding: 16, textAlign: 'left', cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>
                <div style={{ fontSize: 28 }}>🧑‍💼</div>
                <div style={{ marginTop: 10, fontSize: 18, fontWeight: 950 }}>Эксперт</div>
                <div style={{ marginTop: 6, color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Специалист, консультант, наставник или практик.</div>
              </button>
            </div>
          </section>
        )}

        {step === 'form' && (
          <section style={{ ...GLASS, borderRadius: 28, padding: 16 }}>
            <div style={{ color: T.gold, fontSize: 12, fontWeight: 950, letterSpacing: 1, textTransform: 'uppercase' }}>Шаг 3</div>
            <h2 style={{ margin: '8px 0 6px', color: T.textPri, fontSize: 23, lineHeight: '28px', fontWeight: 950 }}>{formTitle}</h2>
            <div style={{ color: T.textSec, fontSize: 13, lineHeight: '20px' }}>Заполнение сохраняется автоматически на этом устройстве. Поля тарифа меняются прямо в анкете.</div>
            <div style={{ marginTop: 10, color: T.textSec, fontSize: 12, lineHeight: '18px' }}>Чтобы вернуться к выбору направления, используйте кнопку ниже.</div>
            <div style={{ marginTop: 14 }}>
              {selectedType === 'expert'
                ? <ExpertQuestionnaire fields={fields} files={files} onField={setField} onFiles={handleFiles} uploading={uploading} />
                : <PartnerQuestionnaire fields={fields} files={files} onField={setField} onFiles={handleFiles} uploading={uploading} />
              }
            </div>
            {error && <div style={{ marginTop: 12, color: T.red, fontSize: 13, lineHeight: '19px', fontWeight: 800 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 15 }}>
              <button type="button" onClick={submit} disabled={submitting || uploading} style={{ ...buttonStyle('gold'), opacity: submitting || uploading ? 0.58 : 1 }}>{uploading ? 'Загружаем фото...' : submitting ? 'Отправляем...' : 'Отправить заявку'}</button>
              <button type="button" onClick={() => { setStep('choose'); setError(''); }} style={buttonStyle('plain')}>Изменить направление</button>
            </div>
          </section>
        )}

        {step === 'done' && (
          <section style={{ ...GLASS_GOLD, borderRadius: 30, padding: 22, textAlign: 'center' }}>
            <div style={{ fontSize: 42 }}>✅</div>
            <h1 style={{ margin: '12px 0 0', color: T.textPri, fontSize: 28, lineHeight: '33px', fontWeight: 950 }}>Спасибо!</h1>
            <div style={{ color: T.textPri, fontSize: 17, fontWeight: 900, marginTop: 8 }}>Ваша заявка успешно отправлена.</div>
            <div style={{ color: T.textSec, fontSize: 14, lineHeight: '22px', marginTop: 8 }}>Мы внимательно её рассмотрим и свяжемся с вами. В админке заявка уже попала в очередь модерации.</div>
            {requestId && <div style={{ color: T.textSec, fontSize: 11.5, marginTop: 10 }}>ID заявки: {requestId}</div>}
            <button type="button" onClick={onHome || onBack} style={{ ...buttonStyle('gold'), marginTop: 18 }}>Вернуться в приложение</button>
          </section>
        )}
      </div>
    </div>
  );
}
