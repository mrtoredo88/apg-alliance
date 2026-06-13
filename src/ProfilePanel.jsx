import React, { useMemo } from 'react';
import {
  PanelHeader,
  Group,
  Header,
  Avatar,
  Button,
  Progress,
  Footnote,
  Div,
  Text,
  Title,
  Caption,
  Placeholder,
  CellButton,
} from '@vkontakte/vkui';
import {
  Icon28UserCircleOutline,
  Icon28Notification,
  Icon28SettingsOutline,
  Icon28DoorArrowRightOutline,
  Icon16AchievementCircleFillBlue,
} from '@vkontakte/icons';

const LEVELS = [
  { id: 1, title: 'Новичок',          minKeys: 0,  color: '#99A2AD', emoji: '🌱' },
  { id: 2, title: 'Участник',         minKeys: 5,  color: '#3F8AE0', emoji: '⚡' },
  { id: 3, title: 'Активный',         minKeys: 15, color: '#4BB34B', emoji: '🔥' },
  { id: 4, title: 'VIP участник АПК', minKeys: 30, color: '#FFA000', emoji: '👑' },
];

const ACHIEVEMENTS_CONFIG = [
  { id: 'first_scan',     title: 'Первый шаг',    emoji: '🎯', color: '#3F8AE0', condition: (k)    => k >= 1 },
  { id: 'five_keys',      title: 'Коллекционер',  emoji: '🗝️', color: '#FFA000', condition: (k)    => k >= 5 },
  { id: 'ten_keys',       title: 'Исследователь', emoji: '🔍', color: '#4BB34B', condition: (k)    => k >= 10 },
  { id: 'first_favorite', title: 'Знаток',         emoji: '⭐', color: '#E64646', condition: (k, f) => f.length >= 1 },
  { id: 'five_favorites', title: 'Свой человек',   emoji: '❤️', color: '#E64646', condition: (k, f) => f.length >= 5 },
  { id: 'vip',            title: 'VIP',            emoji: '👑', color: '#FFA000', condition: (k)    => k >= 30 },
];

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
  return Math.round(((keys - current.minKeys) / (next.minKeys - current.minKeys)) * 100);
}

function AchievementCard({ achievement, unlocked }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: 80, gap: 6,
      opacity: unlocked ? 1 : 0.35,
      filter: unlocked ? 'none' : 'grayscale(1)',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: unlocked ? achievement.color + '22' : '#99A2AD22',
        border: `2px solid ${unlocked ? achievement.color : '#99A2AD44'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, position: 'relative',
      }}>
        {achievement.emoji}
        {unlocked && (
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            background: achievement.color, borderRadius: '50%',
            width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon16AchievementCircleFillBlue width={10} height={10} />
          </div>
        )}
      </div>
      <Caption style={{
        textAlign: 'center', lineHeight: '13px', fontSize: 11,
        color: unlocked ? '#000' : '#99A2AD',
        fontWeight: unlocked ? 600 : 400,
      }}>
        {achievement.title}
      </Caption>
    </div>
  );
}

function FavoritePartnerCard({ partner, onOpen, onRemove }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
    }}>
      {partner.logoUrl
        ? <Avatar size={48} src={partner.logoUrl} />
        : <Avatar size={48}><span style={{ fontSize: 20 }}>🏪</span></Avatar>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text weight="semibold" style={{ marginBottom: 2, color: '#000' }}>
          {partner.name ?? 'Партнёр'}
        </Text>
        {partner.description && (
          <Caption style={{ color: '#99A2AD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {partner.description}
          </Caption>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button size="s" mode="primary" onClick={() => onOpen(partner)}>Открыть</Button>
        <Button size="s" mode="tertiary" onClick={() => onRemove(partner.id)}>✕</Button>
      </div>
    </div>
  );
}

// Экспортируем без Panel — Panel добавляется в UserApp.jsx
export function ProfilePanel({
  user, userKeys = 0, favorites = [], partners = [],
  onToggleFavorite, onOpenPartner, onLogout,
}) {
  const safeUser = user || { first_name: 'Участник', last_name: 'АПГ', photo_200: null };

  const currentLevel = getCurrentLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const levelProgress = getLevelProgress(userKeys);

  const achievements = useMemo(
    () => ACHIEVEMENTS_CONFIG.map((a) => ({ ...a, unlocked: a.condition(userKeys, favorites) })),
    [userKeys, favorites]
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const favoritePartners = useMemo(
    () => partners.filter((p) => favorites.includes(p.id)),
    [partners, favorites]
  );

  const stats = [
    { label: 'Ключей',     value: userKeys,                                emoji: '🗝️' },
    { label: 'Избранное',  value: favorites.length,                         emoji: '⭐' },
    { label: 'Достижения', value: `${unlockedCount}/${achievements.length}`, emoji: '🏆' },
  ];

  return (
    <div style={{ background: '#f2f3f5', minHeight: '100%' }}>
      <PanelHeader>Профиль</PanelHeader>

      {/* Шапка */}
      <Group>
        <Div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 8 }}>
          <Avatar size={80} src={safeUser.photo_200 ?? undefined} />
          <div style={{ textAlign: 'center' }}>
            <Title level="2" weight="semibold" style={{ color: '#000' }}>
              {safeUser.first_name} {safeUser.last_name}
            </Title>
            <Caption style={{ color: '#99A2AD', marginTop: 2 }}>Участник АПГ</Caption>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: currentLevel.color + '22',
            border: `1px solid ${currentLevel.color}55`,
            borderRadius: 20, padding: '4px 12px',
          }}>
            <span style={{ fontSize: 14 }}>{currentLevel.emoji}</span>
            <Caption style={{ color: currentLevel.color, fontWeight: 600 }}>{currentLevel.title}</Caption>
          </div>
        </Div>
        <Div style={{ paddingTop: 0 }}>
          <Progress value={levelProgress} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <Footnote style={{ color: '#99A2AD' }}>Ключей: {userKeys}</Footnote>
            <Footnote style={{ color: '#99A2AD' }}>
              {nextLevel ? `До «${nextLevel.title}»: ${nextLevel.minKeys - userKeys}` : '🏆 Максимальный уровень'}
            </Footnote>
          </div>
        </Div>
      </Group>

      {/* Статистика */}
      <Group header={<Header mode="secondary">Статистика</Header>}>
        <Div style={{ paddingTop: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji}</div>
                <Title level="3" weight="semibold" style={{ color: '#000' }}>{s.value}</Title>
                <Caption style={{ color: '#99A2AD', lineHeight: '14px' }}>{s.label}</Caption>
              </div>
            ))}
          </div>
        </Div>
      </Group>

      {/* Достижения */}
      <Group header={
        <Header mode="secondary" aside={
          <Caption style={{ color: '#99A2AD' }}>{unlockedCount} из {achievements.length}</Caption>
        }>
          Достижения
        </Header>
      }>
        {unlockedCount === 0 ? (
          <Placeholder icon={<span style={{ fontSize: 40 }}>🏅</span>}>
            Сканируй QR-коды партнёров — так появятся первые достижения
          </Placeholder>
        ) : (
          <Div style={{ paddingTop: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {achievements.map((a) => <AchievementCard key={a.id} achievement={a} unlocked={a.unlocked} />)}
            </div>
          </Div>
        )}
      </Group>

      {/* Избранное */}
      <Group header={
        <Header mode="secondary" aside={
          favoritePartners.length > 0 && <Caption style={{ color: '#99A2AD' }}>{favoritePartners.length}</Caption>
        }>
          Избранное
        </Header>
      }>
        {favoritePartners.length === 0 ? (
          <Placeholder icon={<span style={{ fontSize: 40 }}>⭐</span>}>
            Добавляй партнёров в избранное — они появятся здесь
          </Placeholder>
        ) : (
          <Div style={{ paddingTop: 0 }}>
            {favoritePartners.map((p) => (
              <FavoritePartnerCard key={p.id} partner={p} onOpen={onOpenPartner} onRemove={onToggleFavorite} />
            ))}
          </Div>
        )}
      </Group>

      {/* Настройки */}
      <Group header={<Header mode="secondary">Настройки</Header>}>
        <CellButton before={<Icon28Notification />}>Уведомления</CellButton>
        <CellButton before={<Icon28SettingsOutline />}>Настройки профиля</CellButton>
      </Group>

      {/* Выход */}
      <Group>
        <CellButton mode="danger" before={<Icon28DoorArrowRightOutline />} onClick={onLogout}>
          Выйти из аккаунта
        </CellButton>
      </Group>

      <Div style={{ height: 16 }} />
    </div>
  );
}
