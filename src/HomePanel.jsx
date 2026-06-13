import React, { useState } from 'react';
import {
  Panel,
  PanelHeader,
  Group,
  Header,
  Avatar,
  Button,
  Div,
  HorizontalScroll,
  Text,
  Title,
  Caption,
  Footnote,
  Card,
  Placeholder,
  SimpleCell,
} from '@vkontakte/vkui';
import {
  Icon28FireOutline,
  Icon28CalendarOutline,
  Icon28UsersOutline,
  Icon28KeyOutline,
} from '@vkontakte/icons';

// ─── Категории партнёров ──────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',   label: 'Все',        emoji: '🏙️' },
  { id: 'food',  label: 'Еда',        emoji: '🍽️' },
  { id: 'beauty',label: 'Красота',    emoji: '💄' },
  { id: 'sport', label: 'Спорт',      emoji: '💪' },
  { id: 'edu',   label: 'Обучение',   emoji: '📚' },
  { id: 'fun',   label: 'Развлечения',emoji: '🎉' },
];

// ─── Карточка события ─────────────────────────────────────────────────────────

function EventCard({ event }) {
  const colors = ['#3F8AE0', '#4BB34B', '#FFA000', '#E64646', '#9C27B0'];
  const color = colors[Math.abs(event.id?.charCodeAt(0) ?? 0) % colors.length];

  return (
    <div style={{
      minWidth: 220,
      borderRadius: 16,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      flexShrink: 0,
    }}>
      {/* Цветная шапка */}
      <div style={{
        height: 80,
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
      }}>
        {event.emoji ?? '🎉'}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <Text weight="semibold" style={{ color: '#000', marginBottom: 4, lineHeight: '18px' }}>
          {event.title ?? '—'}
        </Text>
        {event.date && (
          <Caption style={{ color: '#99A2AD' }}>📅 {event.date}</Caption>
        )}
        {event.partner && (
          <Caption style={{ color: '#99A2AD', display: 'block', marginTop: 2 }}>
            📍 {event.partner}
          </Caption>
        )}
      </div>
    </div>
  );
}

// ─── Карточка партнёра ────────────────────────────────────────────────────────

function PartnerCard({ partner, isFavorite, onOpen, onToggleFavorite }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: 16,
      textAlign: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }}>
        {partner.logoUrl
          ? <Avatar size={60} src={partner.logoUrl} />
          : (
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: '#f2f3f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, margin: '0 auto',
            }}>
              {partner.emoji ?? '🏪'}
            </div>
          )
        }
        <button
          onClick={() => onToggleFavorite(partner.id)}
          style={{
            position: 'absolute', top: -4, right: -4,
            background: isFavorite ? '#E64646' : '#fff',
            border: '2px solid ' + (isFavorite ? '#E64646' : '#e0e0e0'),
            borderRadius: '50%',
            width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 11, padding: 0,
          }}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>

      <div>
        <Text weight="semibold" style={{ color: '#000', fontSize: 13, lineHeight: '16px' }}>
          {partner.name ?? 'Партнёр'}
        </Text>
        {partner.category && (
          <Caption style={{ color: '#99A2AD', marginTop: 2 }}>
            {CATEGORIES.find(c => c.id === partner.category)?.emoji} {partner.categoryLabel ?? ''}
          </Caption>
        )}
      </div>

      <Button size="s" stretched onClick={() => onOpen(partner)}>
        Подробнее
      </Button>
    </div>
  );
}

// ─── Баннер с ключами ─────────────────────────────────────────────────────────

function KeysBanner({ userKeys, userName }) {
  const MAX_KEYS = 50;
  const progress = Math.min(Math.round((userKeys / MAX_KEYS) * 100), 100);

  return (
    <div style={{
      margin: '0 16px 4px',
      borderRadius: 20,
      background: 'linear-gradient(135deg, #3F8AE0, #2D6FBC)',
      padding: '20px 20px 16px',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Декоративные круги */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
      }} />
      <div style={{
        position: 'absolute', bottom: -30, right: 30,
        width: 70, height: 70, borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)',
      }} />

      <Caption style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
        Привет, {userName ?? 'участник'}! 👋
      </Caption>
      <Title level="2" weight="semibold" style={{ color: '#fff', marginBottom: 12 }}>
        Альянс Партнёров Города
      </Title>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>🗝️</span>
        <Text weight="semibold" style={{ color: '#fff', fontSize: 15 }}>
          {userKeys} ключей
        </Text>
        <Caption style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 'auto' }}>
          из {MAX_KEYS}
        </Caption>
      </div>

      {/* Прогресс-бар */}
      <div style={{
        height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: '#fff', borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Быстрые действия ────────────────────────────────────────────────────────

function QuickActions({ onScan }) {
  const actions = [
    { icon: '📷', label: 'Сканировать QR', color: '#3F8AE0', onClick: onScan },
    { icon: '🎁', label: 'Акции',          color: '#4BB34B', onClick: () => {} },
    { icon: '🏆', label: 'Рейтинг',        color: '#FFA000', onClick: () => {} },
    { icon: '👥', label: 'Пригласить',     color: '#E64646', onClick: () => {} },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: 8, padding: '0 16px',
    }}>
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          style={{
            background: '#fff', border: 'none', borderRadius: 16,
            padding: '12px 4px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: a.color + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>
            {a.icon}
          </div>
          <Caption style={{ color: '#000', lineHeight: '13px', textAlign: 'center', fontSize: 10 }}>
            {a.label}
          </Caption>
        </button>
      ))}
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export function HomePanel({
  user,
  userKeys = 0,
  favorites = [],
  partners = [],
  events = [],
  loading = false,
  error = null,
  onOpenPartner,
  onToggleFavorite,
  onScan,
  onRetry,
}) {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredPartners = activeCategory === 'all'
    ? partners
    : partners.filter((p) => p.category === activeCategory);

  return (
    <Panel id="home">
      <PanelHeader>АПГ</PanelHeader>

      {loading && (
        <Div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <Text style={{ color: '#99A2AD' }}>Загружаем данные...</Text>
          </div>
        </Div>
      )}

      {!loading && error && (
        <Placeholder
          header="Нет подключения"
          action={<Button onClick={onRetry}>Попробовать снова</Button>}
        >
          {error}
        </Placeholder>
      )}

      {!loading && !error && (
        <>
          {/* Баннер */}
          <Div style={{ paddingBottom: 0 }}>
            <KeysBanner
              userKeys={userKeys}
              userName={user?.first_name}
            />
          </Div>

          {/* Быстрые действия */}
          <Div style={{ paddingTop: 12, paddingBottom: 4 }}>
            <QuickActions onScan={onScan} />
          </Div>

          {/* События */}
          <Group header={
            <Header mode="secondary" aside={
              <Caption style={{ color: '#3F8AE0' }}>Все события</Caption>
            }>
              🔥 Ближайшие события
            </Header>
          }>
            {events.length === 0 ? (
              <Div>
                <div style={{
                  background: '#fff', borderRadius: 16, padding: 20,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                  <Text weight="semibold" style={{ color: '#000', marginBottom: 4 }}>
                    Скоро будут события
                  </Text>
                  <Caption style={{ color: '#99A2AD' }}>
                    Следи за обновлениями — партнёры АПГ готовят кое-что интересное
                  </Caption>
                </div>
              </Div>
            ) : (
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px' }}>
                  {events.map((e) => <EventCard key={e.id} event={e} />)}
                </div>
              </HorizontalScroll>
            )}
          </Group>

          {/* Фильтр категорий */}
          <HorizontalScroll style={{ paddingBottom: 4 }}>
            <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: activeCategory === cat.id ? '#3F8AE0' : '#fff',
                    color: activeCategory === cat.id ? '#fff' : '#000',
                    fontWeight: activeCategory === cat.id ? 600 : 400,
                    fontSize: 13,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </HorizontalScroll>

          {/* Партнёры */}
          <Group header={
            <Header mode="secondary" aside={
              <Caption style={{ color: '#99A2AD' }}>{filteredPartners.length}</Caption>
            }>
              🤝 Партнёры АПГ
            </Header>
          }>
            {filteredPartners.length === 0 ? (
              <Placeholder icon={<span style={{ fontSize: 40 }}>🔍</span>}>
                В этой категории пока нет партнёров
              </Placeholder>
            ) : (
              <Div style={{ paddingTop: 0 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}>
                  {filteredPartners.map((p) => (
                    <PartnerCard
                      key={p.id}
                      partner={p}
                      isFavorite={favorites.includes(p.id)}
                      onOpen={onOpenPartner}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              </Div>
            )}
          </Group>

          {/* Футер */}
          <Div style={{ textAlign: 'center', paddingTop: 0 }}>
            <Caption style={{ color: '#c4c4c4' }}>
              АПГ — Альянс Партнёров Города 🏙️
            </Caption>
          </Div>

          <Div style={{ height: 16 }} />
        </>
      )}
    </Panel>
  );
}
