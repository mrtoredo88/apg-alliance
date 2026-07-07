import React from 'react';
import { T, GLASS, GLASS_GOLD } from './design.js';
import { openUrl } from './vk.js';

const LAUNCH_DATE = 'Январь 2025';

function StatCard({ icon, value, label, color, sub }) {
  return (
    <div style={{
      ...GLASS,
      borderRadius: 22, padding: '20px 16px', textAlign: 'center',
      border: `1px solid ${color}28`, flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>
        {typeof value === 'number' ? value.toLocaleString('ru') : value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, marginBottom: sub ? 3 : 0 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: T.textSec, lineHeight: '14px' }}>{sub}</div>}
    </div>
  );
}

export function ForPartnersPage({ userCount = 0, partnerCount = 0, totalScans = 0, onBack }) {
  return (
    <>
      {/* Хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{
            background: T.chipBg, border: `1px solid ${T.border}`,
            borderRadius: 12, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0,
          }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>✦ О платформе</div>
            <div style={{ fontSize: 11, color: T.textSec }}>Для партнёров и инвесторов</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px 90px' }}>

        {/* Hero */}
        <div style={{
          ...GLASS_GOLD,
          borderRadius: 28, padding: '28px 20px', marginBottom: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
            АПГ — Ассоциация предпринимателей Зеленограда
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: T.textPri, lineHeight: 1, marginBottom: 4 }}>
            {userCount > 0 ? userCount.toLocaleString('ru') : '—'}
          </div>
          <div style={{ fontSize: 16, color: T.textSec, fontWeight: 600, marginBottom: 20 }}>
            жителей Зеленограда в приложении
          </div>
          <div style={{
            background: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: '12px 16px',
            fontSize: 13, color: T.textSec, lineHeight: '20px',
          }}>
            Реальная аудитория платёжеспособных жителей, которые уже используют приложение для поиска партнёров, участия в событиях и получения привилегий.
          </div>
        </div>

        {/* Ключевые цифры */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <StatCard
            icon="👥" value={userCount} color={T.gold}
            label="Участников" sub="Уникальных пользователей VK"
          />
          <StatCard
            icon="🤝" value={partnerCount} color='#4BB34B'
            label="Партнёров" sub="Бизнесов в программе"
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <StatCard
            icon="📲" value={totalScans} color='#4A90D9'
            label="Визитов к партнёрам" sub="Через QR-код или ссылку"
          />
          <StatCard
            icon="📅" value={LAUNCH_DATE} color={T.textSec}
            label="Дата запуска" sub="Зеленоград"
          />
        </div>

        {/* Что получает партнёр */}
        <div style={{ ...GLASS, borderRadius: 24, padding: '20px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.textPri, marginBottom: 14 }}>
            🎁 Что получает партнёр
          </div>
          {[
            ['🔑', 'Лояльная аудитория', 'Клиенты мотивированы посещать ваш бизнес — за каждый визит они получают ключи.'],
            ['📊', 'Аналитика посещений', 'Личный кабинет с числом визитов и отзывами от реальных клиентов.'],
            ['🎯', 'Продвижение', 'Ваш бизнес появляется в каталоге и новостях, которые видят все участники.'],
            ['💬', 'Прямой контакт', 'Специальные предложения и акции прямо в ленте у тысяч пользователей.'],
          ].map(([icon, title, text]) => (
            <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: T.textSec, lineHeight: '18px' }}>{text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.05))',
          border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 20, padding: '18px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, marginBottom: 6 }}>
            Стать партнёром АПГ
          </div>
          <div style={{ fontSize: 12, color: T.textSec, lineHeight: '18px', marginBottom: 14 }}>
            Свяжитесь с нами — расскажем об условиях и поможем настроить кабинет
          </div>
          <button
            onClick={() => openUrl('https://vk.com/apg_zelenograd')}
            style={{
              padding: '12px 28px', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
              color: '#0F0F1A', fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}
          >
            Написать нам ВКонтакте →
          </button>
        </div>

      </div>
    </>
  );
}
