import React, { useMemo } from 'react';
import {
  Panel,
  PanelHeader,
  Group,
  Header,
  SimpleCell,
  Avatar,
  Button,
  Progress,
  Footnote,
  Div,
  Card,
  Text,
  Title,
  Subhead,
  Caption,
  Placeholder,
  CellButton,
  Badge,
  Separator,
} from '@vkontakte/vkui';
import {
  Icon28UserCircleOutline,
  
  
  Icon28Notification,
  Icon28SettingsOutline,
  Icon28DoorArrowRightOutline,
  Icon16AchievementCircleFillBlue,
  
  
  
  
} from '@vkontakte/icons';

// ─── Конфигурация уровней ────────────────────────────────────────────────────

const LEVELS = [
  { id: 1, title: 'Новичок',          minKeys: 0,   color: '#99A2AD', emoji: '🌱' },
  { id: 2, title: 'Участник',         minKeys: 5,   color: '#3F8AE0', emoji: '⚡' },
  { id: 3, title: 'Активный',         minKeys: 15,  color: '#4BB34B', emoji: '🔥' },
  { id: 4, title: 'VIP участник АПК', minKeys: 30,  color: '#FFA000', emoji: '👑' },
];

const MAX_KEYS = 50;

// ─── Конфигурация достижений ─────────────────────────────────────────────────

const ACHIEVEMENTS_CONFIG = [
  {
    id: 'first_scan',
    title: 'Первый шаг',
    description: 'Отсканировал первый QR-код партнёра',
    emoji: '🎯',
    color: '#3F8AE0',
    condition: (keys, favorites) => keys >= 1,
  },
  {
    id: 'five_keys',
    title: 'Коллекционер',
    description: 'Собрал 5 ключей',
    emoji: '🗝️',
    color: '#FFA000',
    condition: (keys) => keys >= 5,
  },
  {
    id: 'ten_keys',
    title: 'Исследователь',
    description: 'Собрал 10 ключей',
    emoji: '🔍',
    color: '#4BB34B',
    condition: (keys) => keys >= 10,
  },
  {
    id: 'first_favorite',
    title: 'Знаток',
    description: 'Добавил первого партнёра в избранное',
    emoji: '⭐',
    color: '#E64646',
    condition: (keys, favorites) => favorites.length >= 1,
  },
  {
    id: 'five_favorites',
    title: 'Свой человек',
    description: 'Добавил 5 партнёров в избранное',
    emoji: '❤️',
    color: '#E64646',
    condition: (keys, favorites) => favorites.length >= 5,
  },
  {
    id: 'vip',
    title: 'VIP',
    description: 'Достиг статуса VIP участника АПК',
    emoji: '👑',
    color: '#FFA000',
    condition: (keys) => keys >= 30,
  },
];

// ─── Вспомогательные функции ─────────────────────────────────────────────────

function getCurrentLevel(keys) {
  return [...LEVELS].reverse().find((l) => keys >= l.minKeys) ?? LEVELS[0];
}

function getNextLevel(keys) {
  return LEVELS.find((l) => l.minKeys > keys) ?? null;
}

function getLevelProgress(keys) {
  const current = getCurrentLevel(keys);
  const next = getNextLevel(keys);
  if (!next) return 100;
  const range = next.minKeys - current.minKeys;
  const done = keys - current.minKeys;
  return Math.round((done / range) * 100);
}

// ─── Компонент карточки достижения ──────────────────────────────────────────

function AchievementCard({ achievement, unlocked }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 88,
        gap: 6,
        opacity: unlocked ? 1 : 0.35,
        filter: unlocked ? 'none' : 'grayscale(1)',
        transition: 'opacity 0.2s',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: unlocked ? achievement.color + '22' : '#99A2AD22',
          border: `2px solid ${unlocked ? achievement.color : '#99A2AD44'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          position: 'relative',
        }}
      >
        {achievement.emoji}
        {unlocked && (
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              background: achievement.color,
              borderRadius: '50%',
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon16Star width={10} height={10} style={{ color: '#fff' }} />
          </div>
        )}
      </div>
      <Caption
        style={{
          textAlign: 'center',
          lineHeight: '14px',
          color: unlocked
            ? 'var(--vkui--color_text_primary)'
            : 'var(--vkui--color_text_secondary)',
          fontWeight: unlocked ? 600 : 400,
        }}
      >
        {achievement.title}
      </Caption>
    </div>
  );
}

// ─── Компонент карточки партнёра в избранном ────────────────────────────────

function FavoritePartnerCard({ partner, onOpen, onRemove }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
      }}
    >
      {partner.logoUrl ? (
        <Avatar size={48} src={partner.logoUrl} />
      ) : (
        <Avatar size={48}>
          <span style={{ fontSize: 20 }}>🏪</span>
        </Avatar>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold" style={{ marginBottom: 2 }}>
          {partner.name ?? 'Партнёр'}
        </Text>
        {partner.description && (
          <Caption
            style={{
              color: 'var(--vkui--color_text_secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {partner.description}
          </Caption>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button size="s" mode="primary" onClick={() => onOpen(partner)}>
          Открыть
        </Button>
        <Button size="s" mode="tertiary" onClick={() => onRemove(partner.id)}>
          ✕
        </Button>
      </div>
    </div>
  );
}

// ─── Основной компонент ProfilePanel ────────────────────────────────────────

/**
 * ProfilePanel — вкладка профиля для VK Mini App АПК.
 *
 * Props:
 *   user          — объект пользователя из vkBridge.send('VKWebAppGetUserInfo')
 *   userKeys      — количество ключей (number)
 *   favorites     — массив id избранных партнёров (string[])
 *   partners      — полный массив партнёров из Firebase
 *   onToggleFavorite(partnerId) — колбэк для удаления из избранного
 *   onOpenPartner(partner)      — колбэк для перехода на карточку партнёра
 *   onLogout()                  — колбэк для выхода
 */
export function ProfilePanel({
  user,
  userKeys = 0,
  favorites = [],
  partners = [],
  onToggleFavorite,
  onOpenPartner,
  onLogout,
}) {
  // Уровень и прогресс
  const currentLevel = getCurrentLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const levelProgress = getLevelProgress(userKeys);

  // Достижения
  const achievements = useMemo(
    () =>
      ACHIEVEMENTS_CONFIG.map((a) => ({
        ...a,
        unlocked: a.condition(userKeys, favorites),
      })),
    [userKeys, favorites]
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  // Партнёры в избранном
  const favoritePartners = useMemo(
    () => partners.filter((p) => favorites.includes(p.id)),
    [partners, favorites]
  );

  // Статистика
  const stats = [
    { label: 'Ключей собрано',   value: userKeys,           emoji: '🗝️' },
    { label: 'В избранном',       value: favorites.length,   emoji: '⭐' },
    { label: 'Достижений',        value: `${unlockedCount}/${achievements.length}`, emoji: '🏆' },
  ];

  if (!user) {
    return (
      <Panel id="profile">
        <PanelHeader>Профиль</PanelHeader>
        <Placeholder
          icon={<Icon28UserCircleOutline width={56} height={56} />}
          header="Загрузка профиля"
        >
          Получаем данные из ВКонтакте...
        </Placeholder>
      </Panel>
    );
  }

  return (
    <Panel id="profile">
      <PanelHeader>Профиль</PanelHeader>

      {/* ── Шапка профиля ── */}
      <Group>
        <Div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 8,
            paddingBottom: 4,
            gap: 8,
          }}
        >
          <Avatar size={80} src={user.photo_200 ?? undefined} />

          <div style={{ textAlign: 'center' }}>
            <Title level="2" weight="semibold">
              {user.first_name} {user.last_name}
            </Title>
            <Caption style={{ color: 'var(--vkui--color_text_secondary)', marginTop: 2 }}>
              Участник АПК
            </Caption>
          </div>

          {/* Бейдж уровня */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: currentLevel.color + '22',
              border: `1px solid ${currentLevel.color}55`,
              borderRadius: 20,
              padding: '4px 12px',
            }}
          >
            <span style={{ fontSize: 14 }}>{currentLevel.emoji}</span>
            <Caption style={{ color: currentLevel.color, fontWeight: 600 }}>
              {currentLevel.title}
            </Caption>
          </div>
        </Div>

        {/* Прогресс до следующего уровня */}
        <Div style={{ paddingTop: 0 }}>
          <Progress value={levelProgress} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
            }}
          >
            <Footnote style={{ color: 'var(--vkui--color_text_secondary)' }}>
              Ключей: {userKeys}
            </Footnote>
            <Footnote style={{ color: 'var(--vkui--color_text_secondary)' }}>
              {nextLevel
                ? `До «${nextLevel.title}»: ${nextLevel.minKeys - userKeys}`
                : '🏆 Максимальный уровень'}
            </Footnote>
          </div>
        </Div>
      </Group>

      {/* ── Статистика ── */}
      <Group header={<Header mode="secondary">Статистика</Header>}>
        <Div style={{ paddingTop: 0 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '12px 8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
                <Title level="3" weight="semibold">
                  {s.value}
                </Title>
                <Caption style={{ color: 'var(--vkui--color_text_secondary)', lineHeight: '14px' }}>
                  {s.label}
                </Caption>
              </div>
            ))}
          </div>
        </Div>
      </Group>

      {/* ── Достижения ── */}
      <Group
        header={
          <Header
            mode="secondary"
            aside={
              <Caption style={{ color: 'var(--vkui--color_text_secondary)' }}>
                {unlockedCount} из {achievements.length}
              </Caption>
            }
          >
            Достижения
          </Header>
        }
      >
        {unlockedCount === 0 ? (
          <Placeholder icon={<span style={{ fontSize: 40 }}>🏅</span>}>
            Сканируй QR-коды партнёров и добавляй в избранное — так появятся первые достижения
          </Placeholder>
        ) : (
          <Div style={{ paddingTop: 0 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {achievements.map((a) => (
                <AchievementCard key={a.id} achievement={a} unlocked={a.unlocked} />
              ))}
            </div>
          </Div>
        )}
      </Group>

      {/* ── Избранное ── */}
      <Group
        header={
          <Header
            mode="secondary"
            aside={
              favoritePartners.length > 0 && (
                <Caption style={{ color: 'var(--vkui--color_text_secondary)' }}>
                  {favoritePartners.length}
                </Caption>
              )
            }
          >
            Избранное
          </Header>
        }
      >
        {favoritePartners.length === 0 ? (
          <Placeholder icon={<span style={{ fontSize: 40 }}>⭐</span>}>
            Добавляй партнёров в избранное — они появятся здесь
          </Placeholder>
        ) : (
          <Div style={{ paddingTop: 0 }}>
            {favoritePartners.map((p) => (
              <FavoritePartnerCard
                key={p.id}
                partner={p}
                onOpen={onOpenPartner}
                onRemove={onToggleFavorite}
              />
            ))}
          </Div>
        )}
      </Group>

      {/* ── Уведомления и настройки ── */}
      <Group header={<Header mode="secondary">Настройки</Header>}>
        <CellButton before={<Icon28Notification />}>
          Уведомления
        </CellButton>
        <CellButton before={<Icon28SettingsOutline />}>
          Настройки профиля
        </CellButton>
      </Group>

      {/* ── Выход ── */}
      <Group>
        <CellButton
          mode="danger"
          before={<Icon28DoorArrowRightOutline />}
          onClick={onLogout}
        >
          Выйти из аккаунта
        </CellButton>
      </Group>

      {/* Отступ снизу для таббара */}
      <Div style={{ height: 16 }} />
    </Panel>
  );
}
