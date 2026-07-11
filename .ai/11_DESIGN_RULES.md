# 11 DESIGN RULES

## Принципы UI

1. **V3 Glass System** — все пользовательские экраны используют единый glass-материал
2. **Light-primary** — светлая тема основная, тёмная доступна через профиль
3. **Gold accent** — `#C9A84C` единственный брендовый цвет, везде одинаковый
4. **Inline styles only** — никаких CSS классов, никаких CSS модулей
5. **Manrope font** — единственный шрифт проекта

---

## Цветовая палитра

### Основные токены (из `src/design.js`)

| Токен | Dark value | Light value | Назначение |
|---|---|---|---|
| `T.bg` | `#0F0F1A` | `#F0F2F5` | Фон страницы |
| `T.surface` | `#1A1A2E` | `#FFFFFF` | Фон карточки |
| `T.surface2` | `#12122A` | `#F5F5FA` | Фон вложенной карточки |
| `T.border` | `rgba(255,255,255,0.07)` | `rgba(0,0,0,0.08)` | Граница |
| `T.textPri` | `#F0F0F0` | `#1C1B1E` | Основной текст |
| `T.textSec` | `rgba(240,240,240,0.5)` | `rgba(28,27,30,0.45)` | Вторичный текст |
| `T.chipBg` | `rgba(255,255,255,0.07)` | `rgba(0,0,0,0.06)` | Фон чипа/кнопки |
| `T.gold` | `#C9A84C` | `#C9A84C` | Золотой (не меняется) |
| `T.goldL` | `#E8C97A` | `#E8C97A` | Светлый золотой |
| `T.blue` | `#4A90D9` | `#4A90D9` | Синий акцент |
| `T.green` | `#4BB34B` | `#4BB34B` | Успех |
| `T.red` | `#E64646` | `#E64646` | Опасность |

### Фон страницы

Тройной radial-gradient (body, fixed):
```css
background:
  radial-gradient(ellipse at 20% 10%, rgba(76,40,130,0.45) 0%, transparent 60%),  /* фиолетовый шар сверху */
  radial-gradient(ellipse at 80% 90%, rgba(30,50,130,0.35) 0%, transparent 60%),  /* синий шар снизу */
  radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%); /* золотое свечение */
background-color: var(--c-bg);
background-attachment: fixed;
```

### Gold-специфичные значения

```js
const goldDim    = 'rgba(201,168,76,0.12)'; // фон золотого чипа
const goldBrd    = 'rgba(201,168,76,0.35)'; // граница золотого чипа
const goldBrdStr = 'rgba(201,168,76,0.5)';  // граница акцент
```

---

## Типографика

**Шрифт:** Manrope (self-hosted, `/fonts/manrope/*.woff2`)  
**Весa:** 400, 500, 600, 700, 800

| Использование | Size | Weight |
|---|---|---|
| Заголовки h2 (AdminPanel) | 18–20px | 700 |
| Заголовки секций | 17–18px | 700 |
| Основной текст | 14–15px | 500 |
| Вторичный текст | 12–13px | 400 |
| Подписи, метки | 11px | 600 |
| Таббар labels | 9px | 700, uppercase |
| Бейджи/chips | 9–10px | 700–800 |

---

## Glassmorphism

### GLASS (стандарт для карточек)

```js
{
  background: 'var(--c-glass, rgba(255,255,255,0.04))',
  backdropFilter: 'blur(28px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
  border: '1px solid var(--c-border, rgba(255,255,255,0.07))',
  borderRadius: 20,
}
```

### GLASS_STRONG (усиленный)

```js
{
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(48px) saturate(2)',
  WebkitBackdropFilter: 'blur(48px) saturate(2)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20,
}
```

### GLASS_GOLD (золотой тинт)

```js
{
  background: 'rgba(201,168,76,0.08)',
  backdropFilter: 'blur(28px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
  border: '1px solid rgba(201,168,76,0.25)',
  borderRadius: 20,
}
```

---

## V3 UI Kit

Основные пользовательские экраны должны использовать локальные glass-примитивы из `src/components/Apg2ProfileGlass.jsx`:

- `GlassCard`
- `GlassButton`
- `GlassInput`
- `GlassSelect`
- `GlassSwitch`
- `GlassLoader`
- `GlassToast`
- `ApgModal`
- `ScreenHeader`
- `EmptyStateV2`

Нижняя навигация живёт в `UserApp.jsx` как единый Floating Island через `createPortal(..., document.body)`. Старые V1 tabbar/pill-ветки удалены.

## APG Design System 2.0

Цель DS 2.0 — визуально объединить User Mode, Desktop Workspace и Business Hub. Разные режимы могут иметь разный сценарий, но должны ощущаться как один продукт АПГ.

### Visual language

- User Mode — эмоциональный, городской, более лёгкий.
- Workspace — рабочий, спокойный, более структурный.
- Business Hub — деловой слой внутри Workspace.
- Все три слоя используют один APG2 foundation из `src/components/Apg2ProfileGlass.jsx`.

### Единые токены APG2

`APG2_PROFILE` содержит:

- `bg` — общий эмоциональный фон User Mode;
- `workspaceBg` — рабочий фон Workspace без ощущения отдельной тёмной админки;
- `heroSurface` — поверхность для главного смыслового блока;
- `quietSurface` — вторичная поверхность для supporting cards;
- `glass` / `goldGlass` — единые материалы;
- `radius` — уровни скруглений;
- `rhythm` — базовые отступы page / section / panel / cluster.

### Уровни карточек

1. Hero — главный центр внимания, один на сценарий.
2. Primary cards — ключевые рабочие действия.
3. Quiet cards — метрики, строки, supporting-информация.

Не все карточки должны иметь одинаковый вес. Если экран выглядит как сетка одинаковых плиток, нужно поднять главный сценарий в hero и снизить supporting-блоки через `quietSurface`.

### AI Workspace

Правая область Desktop Workspace не является списком или чатом. Это decision center:

- аватар и состояние Локи;
- следующее лучшее действие;
- краткий briefing;
- рабочие решения;
- компактная память диалога;
- быстрые действия.

Локи должен быть визуальным персонажем Workspace, но не перекрывать рабочую область overlay-окнами.

## Компоненты Admin/V1 legacy

### Карточка (card)

```js
const s = {
  card: {
    background: A.surface,
    borderRadius: 20,
    border: `1px solid ${A.border}`,
    padding: '20px 24px',
    marginBottom: 16,
  }
};
```

### Строка списка (row)

```js
s.row = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: `1px solid ${A.border}`,
  gap: 12,
};
```

### Кнопки

```js
s.btn = {
  border: 'none',
  borderRadius: 12,
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
};

s.btnPri  = { background: A.gold, color: '#0F0F1A' };          // основная
s.btnGray = { background: A.chip, color: A.text, border: `1px solid ${A.border}` }; // второстепенная
s.btnDanger = { background: 'rgba(230,70,70,0.15)', color: '#E64646', border: '1px solid rgba(230,70,70,0.3)' }; // опасная
```

### Input / Textarea

```js
s.input = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: `1.5px solid ${A.border}`,
  background: 'rgba(255,255,255,0.04)',
  color: A.text,
  fontSize: 14,
  fontFamily: 'inherit',
  marginBottom: 12,
  outline: 'none',
  boxSizing: 'border-box',
};
```

### Label

```js
s.label = {
  display: 'block',
  fontSize: 12,
  color: A.textSec,
  fontWeight: 600,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
```

### Toggle (switch)

```jsx
// Стандартный паттерн toggle для boolean полей
<div onClick={() => setActive(v => !v)} style={{
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
  background: active ? goldDim : A.chip,
  border: `1px solid ${active ? goldBrd : A.border}`,
}}>
  <div style={{ fontWeight: 700, color: active ? A.gold : A.text }}>Метка</div>
  {/* Pill switch */}
  <div style={{ width: 44, height: 26, borderRadius: 13, position: 'relative',
    background: active ? A.gold : 'rgba(255,255,255,0.15)' }}>
    <div style={{ position: 'absolute', top: 3,
      left: active ? 21 : 3, width: 20, height: 20,
      borderRadius: 10, background: '#fff',
      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
  </div>
</div>
```

### Категорийные пилюли (CONTENT_CATEGORIES)

```jsx
{CONTENT_CATEGORIES.map(cat => (
  <button key={cat.id}
    onClick={() => setCategory(category === cat.id ? '' : cat.id)}
    style={{
      padding: '6px 14px', borderRadius: 20,
      border: `2px solid ${category === cat.id ? cat.color : A.border}`,
      background: category === cat.id ? cat.color + '22' : 'transparent',
      color: category === cat.id ? cat.color : A.textSec,
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }}>
    {cat.label}
  </button>
))}
```

### Badge/pill (метки приоритета)

```jsx
{pri >= 8 && (
  <span style={{
    fontSize: 9, fontWeight: 800, color: A.gold,
    background: 'rgba(201,168,76,0.15)',
    border: '1px solid rgba(201,168,76,0.3)',
    borderRadius: 5, padding: '1px 5px', flexShrink: 0,
  }}>
    📌 {pri}
  </span>
)}
```

---

## Таббар (Bottom Navigation)

```
position: fixed
bottom: 16px
left: 50%, transform: translateX(-50%)
width: calc(100% - 32px), max-width: 448px
height: 62px
borderRadius: 36 (pill)
background: rgba(12,12,30,0.55) (dark)
backdropFilter: blur(28px) saturate(2)
boxShadow: 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)
```

**Animated indicator:** золотой pill, позиционируется через `left` + `transition: left 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)` (bounce effect).

**Иконки:** SVG stroke (не fill). Цвет: `#C9A84C` active, `rgba(...)` inactive. Нет emoji в таббаре.

**Scan button:** в центре, `marginTop: -14px` (выступает выше таббара), круглая, gold gradient, glow ring через `boxShadow`.

---

## Анимации

### CSS keyframes (в `index.css`)

| Анимация | Где используется |
|---|---|
| `fadeInUp` | Появление контента, карточек |
| `shimmer` | Skeleton loader (SkeletonHome) |
| `keyBounceIn` | Появление «ключа» при начислении |
| `keyFlyToCounter` | Анимация ключа, летящего к счётчику |
| `tabFadeIn` | Смена вкладок таббара |
| `toastIn` | Toast уведомления |
| `pulse` | Пульсирование (badge, важные кнопки) |
| `bounce` | Bounce эффект |
| `scanLine` | Линия сканирования в QR Scanner |
| `float` | Плавающие элементы (splash, orbs) |

### Inline transitions

```js
// Стандартные
transition: 'all 0.2s'          // карточки, toggle
transition: 'opacity 0.15s'     // кнопки hover
transition: 'left 0.35s ...'    // таббар индикатор (cubic-bezier bounce)
transition: 'background 0.2s'   // переключатели
```

---

## Адаптивность

Приложение **мобильное по умолчанию**. Нет breakpoints для desktop. Максимальная ширина контента через VK UI `AppRoot` (`sizeX="compact"`).

**Width constraints:**
- `maxWidth: 620` — модальные окна
- `maxWidth: 448` — таббар
- Карточки — full width минус padding

**SafeArea:** `padding-bottom: env(safe-area-inset-bottom)` добавляется к таббару для iPhone notch.

---

## Тёмная / Светлая тема

Переключение через `data-theme` атрибут на `<html>`:
```js
document.documentElement.setAttribute('data-theme', appearance);
```

В CSS:
```css
:root { --c-bg: #0F0F1A; ... }
[data-theme="light"] { --c-bg: #F0F2F5; ... }
```

**Hardcoded значения** (не меняются):
- `gold: '#C9A84C'` и `goldL: '#E8C97A'`
- `blue: '#4A90D9'`
- Цвета баджей: `#4ade80` (проверено), `#f59e0b` (не проверено)
- Цвета CONTENT_CATEGORIES

---

## Модальные окна

**Стандарт:**
- `position: fixed, inset: 0, zIndex: 1000`
- `background: rgba(0,0,0,0.72), backdropFilter: blur(4px)`
- `display: flex, alignItems: flex-start` (прокручиваемое сверху)
- `padding: '32px 16px 48px'` (отступ снизу для телефонного жеста)
- Click на backdrop → `resetForm()` (закрытие)
- Контент: карточка `maxWidth: 620`, `flexShrink: 0`

**Нет VKUI модалок** — только кастомные overlay через `position: fixed`.

---

## Иконки

- **Эмодзи** — в кнопках, заголовках, карточках
- **SVG inline** — в таббаре (кастомные, только stroke)
- **Нет иконочных шрифтов** (FontAwesome и т.п.)
- **Нет VKUI иконок** (`@vkontakte/icons` не используется в основном коде)
