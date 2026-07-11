import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from './constants.js';
import { uploadPhoto } from './utils/uploadPhoto.js';
import { normalizeExternalUrl } from './utils/externalUrls.js';
import { normalizeExpertPhone, registerCustomExpertCategories, validateExpertCategories } from '../server-shared/expert-directory.js';
import { ExpertQuestionnaire } from './components/ExpertQuestionnaire.jsx';
import { PartnerQuestionnaire } from './components/PartnerQuestionnaire.jsx';
import { hasExpertAmbassadorAccess, hasPartnerPremiumAccess, normalizeExpertTariff, normalizePartnerTariff } from './tariffConfig.js';

const TYPES = {
  partner: { label: 'партнёра', title: 'Анкета партнёра', emoji: '🤝' },
  expert: { label: 'эксперта', title: 'Анкета эксперта', emoji: '🧑‍💼' },
  event: { label: 'события', title: 'Анкета события', emoji: '🎉' },
  news: { label: 'новости', title: 'Заявка на новость', emoji: '📢' },
  prize: { label: 'приза', title: 'Анкета приза', emoji: '🎁' },
};

const COMMON_FIELDS = [
  ['contactName', 'Контактное лицо (ФИО)', 'text', 'Как к вам обращаться'],
  ['phone', 'Телефон', 'tel', '+7'],
  ['email', 'Email', 'email', 'mail@example.ru'],
  ['inn', 'ИНН', 'text', '10 или 12 цифр'],
  ['city', 'Город', 'text', 'Зеленоград'],
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
    ['video', 'Видео', 'url', 'Ссылка на видео, если есть'],
    ['newsInfo', 'Новости', 'textarea', 'Что можно рассказать пользователям'],
    ['activities', 'Мероприятия', 'textarea', 'События, мастер-классы, активности'],
    ...COMMON_FIELDS,
    ['comment', 'Комментарий', 'textarea', 'Что ещё важно знать редактору'],
  ],
  expert: [
    ['description', 'Описание', 'textarea', ''],
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
    ['contactName', 'Контактное лицо (ФИО)', 'text', 'Кто отправляет материал'],
    ['phone', 'Телефон', 'tel', '+7'],
    ['email', 'Email', 'email', 'mail@example.ru'],
    ['inn', 'ИНН', 'text', '10 или 12 цифр'],
    ['city', 'Город', 'text', 'Зеленоград'],
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

const LEGAL_ENTITY_TYPES = {
  company: 'ООО / юридическое лицо',
  entrepreneur: 'ИП',
  self_employed: 'Самозанятый',
  individual: 'Физическое лицо',
};

const LEGAL_FIELDS = {
  company: [
    ['fullName', 'Полное наименование', 'text', 'ООО "..."'],
    ['inn', 'ИНН', 'text', '10 цифр'],
    ['kpp', 'КПП', 'text', '9 цифр'],
    ['ogrn', 'ОГРН', 'text', '13 цифр'],
    ['legalAddress', 'Юридический адрес', 'textarea', 'Адрес из ЕГРЮЛ'],
    ['actualAddress', 'Фактический адрес', 'textarea', 'Если отличается'],
    ['checkingAccount', 'Расчётный счёт', 'text', '20 цифр'],
    ['bank', 'Банк', 'text', 'Название банка'],
    ['bik', 'БИК', 'text', '9 цифр'],
    ['directorName', 'ФИО директора', 'text', 'Фамилия Имя Отчество'],
  ],
  entrepreneur: [
    ['fio', 'ФИО', 'text', 'Фамилия Имя Отчество'],
    ['inn', 'ИНН', 'text', '12 цифр'],
    ['ogrnip', 'ОГРНИП', 'text', '15 цифр'],
    ['checkingAccount', 'Расчётный счёт', 'text', '20 цифр'],
    ['bank', 'Банк', 'text', 'Название банка'],
    ['bik', 'БИК', 'text', '9 цифр'],
  ],
  self_employed: [
    ['fio', 'ФИО', 'text', 'Фамилия Имя Отчество'],
    ['inn', 'ИНН', 'text', '12 цифр'],
    ['phone', 'Телефон', 'tel', '+7'],
    ['email', 'Email', 'email', 'mail@example.ru'],
  ],
  individual: [
    ['fio', 'ФИО', 'text', 'Фамилия Имя Отчество'],
    ['phone', 'Телефон', 'tel', '+7'],
    ['email', 'Email', 'email', 'mail@example.ru'],
    ['birthDate', 'Дата рождения (необязательно)', 'date', ''],
    ['address', 'Адрес (необязательно)', 'textarea', 'Для документов, если нужен'],
    ['comment', 'Комментарий', 'textarea', 'Что важно для оформления'],
  ],
};

const LEGAL_DOC_TYPES = [
  ['companyCard', 'Карточка предприятия'],
  ['extract', 'Выписка ЕГРЮЛ / ЕГРИП'],
  ['certificate', 'Свидетельство'],
  ['logo', 'Логотип'],
  ['contract', 'Договор'],
  ['presentation', 'Презентация'],
  ['commercialOffer', 'Коммерческое предложение'],
  ['priceList', 'Прайс-лист'],
];

const DOC_ACCEPT = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const isAllowedDocument = (file) => {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  return /^image\/(jpeg|png)$/.test(type)
    || type === 'application/pdf'
    || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || /\.(pdf|docx|xlsx|jpe?g|png)$/i.test(name);
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
  step: { display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '7px 11px', fontSize: 12, fontWeight: 900 },
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
  const [step, setStep] = useState('public');
  const [fields, setFields] = useState({});
  const [files, setFiles] = useState([]);
  const [legalType, setLegalType] = useState('');
  const [cooperationPlan, setCooperationPlan] = useState('not_now');
  const [legalExpanded, setLegalExpanded] = useState(false);
  const [legalFields, setLegalFields] = useState({});
  const [legalDocuments, setLegalDocuments] = useState([]);
  const [legalDocType, setLegalDocType] = useState('companyCard');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [legalUploading, setLegalUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const type = formInfo?.type || route?.type || 'partner';
  const meta = TYPES[type] || TYPES.partner;
  const formFields = FIELDS[type] || FIELDS.partner;
  const selectedLegalType = legalType || (type === 'expert' ? 'individual' : 'company');
  const legalMeta = LEGAL_ENTITY_TYPES[selectedLegalType] || LEGAL_ENTITY_TYPES.company;
  const legalFormFields = LEGAL_FIELDS[selectedLegalType] || LEGAL_FIELDS.company;
  const isTariffQuestionnaire = type === 'expert' || type === 'partner';
  const draftKey = route?.token && isTariffQuestionnaire ? `apg_tariff_questionnaire_v1:${type}:${route.token}` : '';

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
        if (Array.isArray(data.expertCategories)) registerCustomExpertCategories(data.expertCategories.filter(item => item.custom));
        setFormInfo(data);
        if (['expert', 'partner'].includes(data.type) && draftKey) {
          try {
            const saved = JSON.parse(localStorage.getItem(draftKey) || '{}');
            if (saved.fields && typeof saved.fields === 'object') setFields(saved.fields);
            if (Array.isArray(saved.files)) setFiles(saved.files.filter(file => file?.url));
          } catch {}
        }
      })
      .catch(e => setError(e.message || 'Форма недоступна.'))
      .finally(() => setLoading(false));
  }, [draftKey, route?.token]);

  useEffect(() => {
    if (!isTariffQuestionnaire || !draftKey || !Object.keys(fields).length) return undefined;
    const timer = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ version: 2, fields, files: files.filter(file => file.url).map(({ name, type: fileType, size, url, role }) => ({ name, type: fileType, size, url, role })), updatedAt: new Date().toISOString() })); } catch {}
    }, 450);
    return () => clearTimeout(timer);
  }, [draftKey, fields, files, type]);

  const setField = (name, value) => {
    setFields(prev => ({ ...prev, [name]: value }));
  };

  const setLegalField = (name, value) => {
    setLegalFields(prev => ({ ...prev, [name]: value }));
  };

  const setPlan = (value) => {
    setCooperationPlan(value);
    if (value === 'paid') setLegalExpanded(true);
  };

  const handleFiles = async (list, role = '') => {
    const replacingSingle = ['avatar', 'logo', 'cover', 'main'].includes(role);
    const existing = replacingSingle ? files.filter(file => file.role !== role) : files;
    const all = Array.from(list || []);
    const images = all.filter(file => /^image\//.test(file.type));
    const limit = replacingSingle ? 1 : Math.max(0, 12 - existing.filter(file => file.url).length);
    const incoming = images.slice(0, limit);
    const issues = [
      ...all.filter(file => !/^image\//.test(file.type)).map(file => ({ name: file.name, type: file.type, size: file.size, role: role || 'photo', error: /^video\//.test(file.type) ? 'Видео-файлы не загружаются: добавьте ссылку на видео (YouTube, VK Видео, Rutube, MAX)' : 'Файл не является изображением' })),
      ...images.slice(limit).map(file => ({ name: file.name, type: file.type, size: file.size, role: role || 'photo', error: 'Превышен лимит 12 фотографий' })),
    ];
    if (!incoming.length && !issues.length) return;
    setUploading(true);
    setError('');
    const uploaded = [];
    for (const file of incoming) {
      if (file.size > 8 * 1024 * 1024) {
        uploaded.push({ name: file.name, type: file.type, size: file.size, role: role || 'photo', error: 'Файл больше 8 МБ. Сожмите фото и загрузите снова' });
        continue;
      }
      const preview = URL.createObjectURL(file);
      try {
        const url = await uploadPhoto(file, `public-submissions/${route.token}`);
        uploaded.push({ name: file.name, type: file.type, size: file.size, url, preview, role: role || (files.length || uploaded.length ? 'photo' : 'main') });
      } catch {
        uploaded.push({ name: file.name, type: file.type, size: file.size, role: role || 'photo', error: 'Не удалось загрузить файл. Проверьте интернет и попробуйте ещё раз' });
      }
    }
    const next = [...uploaded, ...issues];
    setFiles(prev => replacingSingle ? [...prev.filter(file => file.role !== role), ...next] : [...prev, ...next]);
    const failed = next.filter(file => file.error);
    if (failed.length) setError(`Не загружено файлов: ${failed.length} (${failed.map(file => file.name).join(', ')}). Они отмечены в списке медиа — удалите их или загрузите заново.`);
    setUploading(false);
  };

  const removeFile = (target) => {
    setFiles(prev => prev.filter(file => file !== target));
  };

  const handleLegalDocuments = async (list) => {
    const incoming = Array.from(list || []).filter(isAllowedDocument).slice(0, Math.max(0, 12 - legalDocuments.length));
    if (!incoming.length) return;
    setLegalUploading(true);
    setError('');
    try {
      const uploaded = [];
      for (const file of incoming) {
        if (file.size > 8 * 1024 * 1024) {
          uploaded.push({ name: file.name, type: file.type, size: file.size, documentType: legalDocType, error: 'Файл больше 8 МБ' });
          continue;
        }
        const url = await uploadPhoto(file, `public-submissions/${route.token}/legal`);
        uploaded.push({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          url,
          documentType: legalDocType,
          documentLabel: LEGAL_DOC_TYPES.find(([id]) => id === legalDocType)?.[1] || 'Документ',
        });
      }
      setLegalDocuments(prev => [...prev, ...uploaded]);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить документ.');
    } finally {
      setLegalUploading(false);
    }
  };

  const validatePublicStep = () => {
    if (type === 'expert') {
      const required = [['lastName', 'фамилию'], ['firstName', 'имя'], ['shortDescription', 'короткое описание'], ['contactName', 'контактное лицо'], ['phone', 'телефон'], ['email', 'email']];
      const missing = required.filter(([key]) => !String(fields[key] || '').trim()).map(([, label]) => label);
      if (!Array.isArray(fields.categories) || !fields.categories.length) missing.push('направление деятельности');
      const categoryIntegrity = validateExpertCategories(fields.categories);
      if (categoryIntegrity.unknown.length) { setError(`Неизвестная категория: ${categoryIntegrity.unknown.join(', ')}. Выберите направление из справочника.`); return false; }
      if (missing.length) { setError(`Заполните обязательные поля: ${missing.join(', ')}.`); return false; }
      if (!/^\+?[\d\s()-]{10,20}$/.test(String(fields.phone))) { setError('Проверьте номер телефона.'); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields.email))) { setError('Проверьте email.'); return false; }
      if (hasExpertAmbassadorAccess(fields.tariff) && fields.inn && !/^\d{10}$|^\d{12}$/.test(String(fields.inn).replace(/\D/g, ''))) { setError('ИНН должен содержать 10 или 12 цифр.'); return false; }
      setError(''); return true;
    }
    if (type === 'partner') {
      const required = [['title', 'название'], ['category', 'категорию'], ['shortDescription', 'короткое описание'], ['description', 'описание'], ['contactName', 'контактное лицо'], ['phone', 'телефон'], ['email', 'email']];
      const missing = required.filter(([key]) => !String(fields[key] || '').trim()).map(([, label]) => label);
      if (missing.length) { setError(`Заполните обязательные поля: ${missing.join(', ')}.`); return false; }
      if (!/^\+?[\d\s()-]{10,20}$/.test(String(fields.phone))) { setError('Проверьте номер телефона.'); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields.email))) { setError('Проверьте email.'); return false; }
      if (hasPartnerPremiumAccess(fields.tariff) && fields.inn && !/^\d{10}$|^\d{12}$/.test(String(fields.inn).replace(/\D/g, ''))) { setError('ИНН должен содержать 10 или 12 цифр.'); return false; }
      setError(''); return true;
    }
    const title = String(fields.title || '').trim();
    const description = String(fields.description || fields.shortDescription || '').trim();
    const required = [
      ['title', 'название'],
      ['contactName', 'контактное лицо'],
      ['phone', 'телефон'],
      ['email', 'email'],
      ['inn', 'ИНН'],
      ['city', 'город'],
      ['description', 'описание'],
    ];
    if (formFields.some(([name]) => name === 'category')) required.push(['category', 'категорию']);
    const missing = required.filter(([key]) => key === 'description' ? !description : !String(fields[key] || '').trim()).map(([, label]) => label);
    if (missing.length) {
      setError(`Заполните обязательные поля: ${missing.join(', ')}.`);
      return false;
    }
    if (!/^\d{10}$|^\d{12}$/.test(String(fields.inn || '').replace(/\D/g, ''))) {
      setError('ИНН должен содержать 10 или 12 цифр.');
      return false;
    }
    setError('');
    return true;
  };

  const submit = async () => {
    if (!validatePublicStep()) return;
    const failedFiles = files.filter(file => file.error);
    if (failedFiles.length) {
      setError(`Обнаружена потеря медиафайлов: ${failedFiles.map(file => file.name).join(', ')}. Загрузите их заново или удалите из списка — иначе они не попадут в карточку.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const normalizedFields = {
        ...fields,
        title: type === 'expert' ? [fields.lastName, fields.firstName, fields.middleName].filter(Boolean).join(' ') : fields.title,
        category: type === 'expert' ? fields.categories?.[0] || '' : fields.category,
        secondaryCategories: type === 'expert' ? (fields.categories || []).slice(1) : fields.secondaryCategories,
        phone: type === 'expert' ? normalizeExpertPhone(fields.phone) : fields.phone,
        tariff: type === 'expert' ? normalizeExpertTariff(fields.tariff) : type === 'partner' ? normalizePartnerTariff(fields.tariff) : fields.tariff,
        website: normalizeExternalUrl(fields.website),
        bookingUrl: normalizeExternalUrl(fields.bookingUrl),
        vk: normalizeExternalUrl(fields.vk, { platform: 'vk' }),
        telegram: normalizeExternalUrl(fields.telegram, { platform: 'telegram' }),
        whatsapp: normalizeExternalUrl(fields.whatsapp, { platform: 'whatsapp' }),
        max: normalizeExternalUrl(fields.max),
        otherSocials: (fields.otherSocials || []).map(value => normalizeExternalUrl(value)).filter(Boolean),
      };
      const res = await fetch(`${API_BASE_URL}/api/public-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-APG-Version': 'public-submit-v1' },
        body: JSON.stringify({
          token: route.token,
          fields: normalizedFields,
          files: files.filter(file => file.url).map(({ name, type, size, url, role }) => ({ name, type, size, url, role })),
          mediaSummary: {
            total: files.filter(file => file.url).length,
            byRole: files.filter(file => file.url).reduce((acc, file) => ({ ...acc, [file.role || 'photo']: (acc[file.role || 'photo'] || 0) + 1 }), {}),
            failed: files.filter(file => file.error).map(({ name, error: reason }) => ({ name, reason })),
            videos: Array.isArray(fields.videos) ? fields.videos.length : (fields.video ? 1 : 0),
          },
          cooperationPlan,
          legalProfile: {
            type: selectedLegalType,
            typeLabel: legalMeta,
            expanded: legalExpanded,
            fields: {
              ...legalFields,
              inn: legalFields.inn || fields.inn,
              phone: legalFields.phone || fields.phone,
              email: legalFields.email || fields.email,
              contactName: fields.contactName,
              website: normalizeExternalUrl(legalFields.website),
              myTaxLink: normalizeExternalUrl(legalFields.myTaxLink),
            },
          },
          legalDocuments: legalDocuments.filter(file => file.url).map(({ name, type, size, url, documentType, documentLabel }) => ({ name, type, size, url, documentType, documentLabel })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Не удалось отправить заявку.');
      setDone(data);
      if (isTariffQuestionnaire && draftKey) { try { localStorage.removeItem(draftKey); } catch {} }
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
            Заполните короткую анкету для публикации карточки и связи. Юридические данные можно добавить позже, если понадобится договор, счёт, ЭДО или рекламное размещение.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <span style={{ ...S.step, background: 'rgba(201,168,76,0.20)', color: '#6b5316' }}>1 · Основная информация</span>
            <span style={{ ...S.step, background: 'rgba(25,23,19,0.06)', color: 'rgba(25,23,19,0.58)' }}>2 · Юридические данные по желанию</span>
          </div>
        </div>

        <div style={S.card}>
          {step === 'public' ? (
            <>
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Публичная карточка</h2>
              <div style={{ color: 'rgba(25,23,19,0.58)', fontSize: 13, lineHeight: '20px', marginBottom: 8 }}>Эти сведения редактор использует для карточки в приложении АПГ.</div>
              {type === 'expert' ? <ExpertQuestionnaire fields={fields} files={files} onField={setField} onFiles={handleFiles} onRemoveFile={removeFile} uploading={uploading} /> : type === 'partner' ? <PartnerQuestionnaire fields={fields} files={files} onField={setField} onFiles={handleFiles} onRemoveFile={removeFile} uploading={uploading} /> : formFields.map(field => (
                <PublicField key={field[0]} field={field} value={fields[field[0]]} onChange={setField} />
              ))}

              {type !== 'expert' && type !== 'partner' && <><span style={S.label}>Фотографии и логотип</span>
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
                    <div key={`${file.name}-${index}`} style={{ borderRadius: 16, overflow: 'hidden', background: file.error ? 'rgba(185,28,28,0.08)' : 'rgba(25,23,19,0.06)', border: `1px solid ${file.error ? 'rgba(185,28,28,0.35)' : 'rgba(25,23,19,0.08)'}`, position: 'relative' }}>
                      {file.preview || file.url ? <img src={file.preview || file.url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} /> : <div style={{ aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⚠️</div>}
                      <button type="button" onClick={() => removeFile(file)} style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 13, lineHeight: '24px', cursor: 'pointer', padding: 0 }}>×</button>
                      <div style={{ padding: 8, fontSize: 10, color: file.error ? '#b91c1c' : 'rgba(25,23,19,0.62)', lineHeight: '14px' }}>{file.error ? `${file.name}: ${file.error}` : file.name}</div>
                    </div>
                  ))}
                </div>
              )}</>}

              {type !== 'expert' && type !== 'partner' && <div style={{ marginTop: 18, padding: 14, borderRadius: 20, background: 'rgba(25,23,19,0.04)', border: '1px solid rgba(25,23,19,0.08)' }}>
                <div style={{ fontSize: 15, fontWeight: 920, color: '#191713' }}>Планируете платное сотрудничество с АПГ?</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  {[
                    ['not_now', 'Пока нет'],
                    ['paid', 'Да'],
                  ].map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setPlan(id)} style={{ ...S.ghost, minHeight: 40, background: cooperationPlan === id ? 'rgba(201,168,76,0.18)' : S.ghost.background, borderColor: cooperationPlan === id ? 'rgba(201,168,76,0.42)' : 'rgba(25,23,19,0.12)' }}>{label}</button>
                  ))}
                </div>
                <div style={{ color: 'rgba(25,23,19,0.58)', fontSize: 12, lineHeight: '18px', marginTop: 8 }}>
                  {cooperationPlan === 'paid'
                    ? 'Локи рекомендует заполнить юридические данные сразу, чтобы быстрее подготовить документы.'
                    : 'Для бесплатной карточки юридические реквизиты сейчас не нужны. Их можно будет запросить позже.'}
                </div>
              </div>}

              {type !== 'expert' && type !== 'partner' && <div style={{ marginTop: 14, borderRadius: 20, border: '1px solid rgba(25,23,19,0.10)', background: 'rgba(255,255,255,0.42)', overflow: 'hidden' }}>
                <button type="button" onClick={() => setLegalExpanded(prev => !prev)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: 'none', background: 'transparent', padding: 15, cursor: 'pointer', textAlign: 'left' }}>
                  <span>
                    <span style={{ display: 'block', color: '#191713', fontSize: 15, fontWeight: 920 }}>Юридические данные (необязательно)</span>
                    <span style={{ display: 'block', color: 'rgba(25,23,19,0.58)', fontSize: 12, lineHeight: '18px', marginTop: 3 }}>
                      Эти сведения понадобятся только для договора, счёта, маркировки рекламы, ЭДО или других юридических процедур.
                    </span>
                  </span>
                  <span style={{ flex: '0 0 auto', color: '#6b5316', fontSize: 13, fontWeight: 950 }}>{legalExpanded ? 'Свернуть' : '+ Заполнить'}</span>
                </button>

                {legalExpanded && (
                  <div style={{ padding: '0 15px 15px' }}>
                    <label>
                      <span style={S.label}>Тип контрагента</span>
                      <select value={selectedLegalType} onChange={e => { setLegalType(e.target.value); setLegalFields({}); }} style={S.input}>
                        {Object.entries(LEGAL_ENTITY_TYPES).filter(([id]) => id !== 'individual' || type === 'expert').map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                    </label>

                    {legalFormFields.map(field => (
                      <PublicField key={field[0]} field={field} value={legalFields[field[0]]} onChange={setLegalField} />
                    ))}

                    <span style={S.label}>Документы</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) 1fr', gap: 10, alignItems: 'center' }}>
                      <select value={legalDocType} onChange={e => setLegalDocType(e.target.value)} style={S.input}>
                        {LEGAL_DOC_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                      <input type="file" multiple accept={DOC_ACCEPT} onChange={e => handleLegalDocuments(e.target.files)} style={{ ...S.input, padding: 10, minHeight: 44 }} />
                    </div>
                    <div style={{ color: 'rgba(25,23,19,0.54)', fontSize: 12, marginTop: 7 }}>PDF, DOCX, XLSX, JPG, PNG до 8 МБ, максимум 12 файлов.</div>

                    {legalDocuments.length > 0 && (
                      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                        {legalDocuments.map((file, index) => (
                          <div key={`${file.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, borderRadius: 14, background: 'rgba(25,23,19,0.05)', border: '1px solid rgba(25,23,19,0.08)', color: file.error ? '#b91c1c' : 'rgba(25,23,19,0.72)', fontSize: 12 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.documentLabel || 'Документ'} · {file.error || file.name}</span>
                            <span>{Math.round(Number(file.size || 0) / 1024)} КБ</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>}

              {error && <div style={{ marginTop: 14, padding: 13, borderRadius: 16, background: 'rgba(220,38,38,0.10)', color: '#b91c1c', fontSize: 13, lineHeight: '19px' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <button type="button" onClick={submit} disabled={submitting || uploading || legalUploading} style={{ ...S.button, opacity: submitting || uploading || legalUploading ? 0.55 : 1 }}>{uploading ? 'Загружаем фото...' : legalUploading ? 'Загружаем документы...' : submitting ? 'Отправляем...' : 'Отправить заявку'}</button>
                <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={S.ghost}>Наверх</button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Юридическая карточка</h2>
              <div style={{ padding: 14, borderRadius: 18, background: 'rgba(201,168,76,0.13)', color: '#6b5316', fontSize: 13, lineHeight: '20px', margin: '10px 0 14px' }}>
                Эти сведения не публикуются в приложении. Они используются только администрацией АПГ для оформления сотрудничества, договоров, ЭДО и внутренней CRM.
              </div>

              <label>
                <span style={S.label}>Тип контрагента</span>
                <select value={selectedLegalType} onChange={e => { setLegalType(e.target.value); setLegalFields({}); }} style={S.input}>
                  {Object.entries(LEGAL_ENTITY_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>

              {legalFormFields.map(field => (
                <PublicField key={field[0]} field={field} value={legalFields[field[0]]} onChange={setLegalField} />
              ))}

              <span style={S.label}>Документы</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 220px) 1fr', gap: 10, alignItems: 'center' }}>
                <select value={legalDocType} onChange={e => setLegalDocType(e.target.value)} style={S.input}>
                  {LEGAL_DOC_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <input type="file" multiple accept={DOC_ACCEPT} onChange={e => handleLegalDocuments(e.target.files)} style={{ ...S.input, padding: 10, minHeight: 44 }} />
              </div>
              <div style={{ color: 'rgba(25,23,19,0.54)', fontSize: 12, marginTop: 7 }}>PDF, DOCX, XLSX, JPG, PNG до 8 МБ, максимум 12 файлов.</div>

              {legalDocuments.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {legalDocuments.map((file, index) => (
                    <div key={`${file.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, borderRadius: 14, background: 'rgba(25,23,19,0.05)', border: '1px solid rgba(25,23,19,0.08)', color: file.error ? '#b91c1c' : 'rgba(25,23,19,0.72)', fontSize: 12 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.documentLabel || 'Документ'} · {file.error || file.name}</span>
                      <span>{Math.round(Number(file.size || 0) / 1024)} КБ</span>
                    </div>
                  ))}
                </div>
              )}

              {error && <div style={{ marginTop: 14, padding: 13, borderRadius: 16, background: 'rgba(220,38,38,0.10)', color: '#b91c1c', fontSize: 13, lineHeight: '19px' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <button type="button" onClick={submit} disabled={submitting || uploading || legalUploading} style={{ ...S.button, opacity: submitting || uploading || legalUploading ? 0.55 : 1 }}>{legalUploading ? 'Загружаем документы...' : submitting ? 'Отправляем...' : 'Отправить заявку'}</button>
                <button type="button" onClick={() => { setStep('public'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={S.ghost}>Назад</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function isPublicSubmitRoute() {
  return Boolean(readSubmitRoute());
}
