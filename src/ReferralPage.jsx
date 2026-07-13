import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { T, GLASS } from './design.js';
import vkBridge from './vk.js';
import { buildReferralInviteText, buildReferralLink } from './referralInvite.js';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassListItem, GlassPanel, GlassSection, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';

const MILESTONES = [
  { count: 1, reward: 3,  label: '1 друг',   taskId: 'referral_1' },
  { count: 3, reward: 8,  label: '3 друга',  taskId: 'referral_3' },
  { count: 5, reward: 15, label: '5 друзей', taskId: 'referral_5' },
];

const STEPS = [
  { emoji: '🔗', title: 'Поделись ссылкой', desc: 'Отправь другу свою реферальную ссылку или покажи QR-код' },
  { emoji: '📲', title: 'Друг регистрируется', desc: 'Он переходит по ссылке и открывает приложение АПГ' },
  { emoji: '🗝️', title: 'Оба получают ключи', desc: 'Ты и твой друг каждый получаете +2 ключа сразу' },
];

export function ReferralPage({ variant = 'v2', user, referralCount = 0, completedTasks = [], onBack, onShare }) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const refLink = buildReferralLink(user);
  const inviteText = buildReferralInviteText(refLink);

  const handleCopy = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(inviteText); ok = true; } catch {}
    if (!ok) {
      try {
        await vkBridge.send('VKWebAppCopyText', { text: inviteText });
        ok = true;
      } catch {}
    }
    if (!ok) return;
    setCopied(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'АПГ — Альянс Партнёров Города', text: inviteText });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    vkBridge.send('VKWebAppShare', { link: refLink, text: inviteText }).catch(() => {});
  };

  const milestoneKeys = MILESTONES
    .filter(m => completedTasks.includes(m.taskId))
    .reduce((s, m) => s + m.reward, 0);
  const earnedKeys = referralCount * 2 + milestoneKeys;

  if (variant === 'v2') {
    return (
      <GlassPanel>
        <ScreenHeader title="Друзья" subtitle="Реферальная программа" kicker="Приглашения" onBack={onBack} />
        <GlassCard tone="gold" style={{ borderRadius: 38, padding: 22, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 14%,rgba(255,255,255,0.26),transparent 34%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <GlassBadge style={{ color: '#17120a', background: 'rgba(255,255,255,0.28)' }}>+2 ключа каждому</GlassBadge>
            <div style={{ color: '#17120a', fontSize: 31, lineHeight: '34px', fontWeight: 930, marginTop: 16 }}>Позови друга в АПГ</div>
            <div style={{ color: 'rgba(20,15,8,0.68)', fontSize: 14, lineHeight: '20px', marginTop: 10 }}>Покажи QR-код или отправь ссылку. Когда друг присоединится, ключи получите вы оба.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <StatPill label="друзей пришло" value={referralCount} />
              <StatPill label="ключей заработано" value={earnedKeys} />
            </div>
          </div>
        </GlassCard>
        <GlassCard style={{ borderRadius: 34, padding: 20, marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13 }}>Ваш персональный QR</div>
          {user?.id ? (
            <div style={{ background: '#fff', borderRadius: 24, padding: 15, boxShadow: '0 22px 50px rgba(0,0,0,0.28)' }}>
              <QRCodeSVG value={refLink} size={184} bgColor="#ffffff" fgColor="#101114" level="M" />
            </div>
          ) : (
            <div style={{ width: 214, height: 214, borderRadius: 28, background: APG2_PROFILE.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🔗</div>
          )}
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12 }}>ID: {user?.id ?? '—'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
            <GlassButton onClick={handleShare} tone="gold" style={{ color: '#17120a' }}>Поделиться</GlassButton>
            <GlassButton onClick={handleCopy}>{copied ? 'Скопировано' : 'Ссылка'}</GlassButton>
          </div>
        </GlassCard>
        <GlassSection title="Награды">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MILESTONES.map(m => {
              const done = completedTasks.includes(m.taskId);
              const reached = referralCount >= m.count;
              return <GlassListItem key={m.taskId} icon={done ? '✓' : '👥'} title={m.label} subtitle={done ? 'Награда получена' : `${Math.min(referralCount, m.count)} / ${m.count}`} meta={`+${m.reward}`} accent={reached ? APG2_PROFILE.gold : undefined} />;
            })}
          </div>
        </GlassSection>
        <GlassSection title="Как это работает">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STEPS.map((step, i) => <GlassListItem key={step.title} icon={step.emoji} title={step.title} subtitle={step.desc} meta={`0${i + 1}`} />)}
          </div>
        </GlassSection>
      </GlassPanel>
    );
  }

  return (
    <>
      {/* Хедер */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.headerBorder}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>👥 Пригласить друзей</div>
        </div>
      </div>

      <div style={{ background: 'transparent', minHeight: '100%', padding: '12px 16px 90px' }}>

        {/* Hero */}
        <div style={{ borderRadius: 24, background: T.surface, padding: '24px 20px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(74,144,217,0.3)', marginBottom: 16, animation: 'fadeInUp 0.4s ease both' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(74,144,217,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,144,217,0.12), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, color: T.blue, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, opacity: 0.85 }}>✦ Реферальная программа</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: T.textPri, lineHeight: 1.2, marginBottom: 8 }}>
              Позови друга —<br />получите ключи вместе
            </div>
            <div style={{ fontSize: 13, color: T.textSec, lineHeight: '18px', marginBottom: 20 }}>
              За каждого друга, который присоединился по твоей ссылке, ты и он получаете по{' '}
              <span style={{ color: T.goldL, fontWeight: 700 }}>+2 🗝️</span>
            </div>

            {/* Счётчики */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 16, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: T.textPri, lineHeight: 1 }}>{referralCount}</div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>
                  {(() => { const n = referralCount % 100, n1 = n % 10; if (n >= 11 && n <= 19) return 'друзей пришло'; if (n1 === 1) return 'друг пришёл'; if (n1 >= 2 && n1 <= 4) return 'друга пришли'; return 'друзей пришло'; })()}
                </div>
              </div>
              <div style={{ flex: 1, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 16, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: T.gold, lineHeight: 1 }}>{earnedKeys}</div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>ключей заработано</div>
              </div>
            </div>
          </div>
        </div>

        {/* QR + Кнопки */}
        <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden', marginBottom: 16, animation: 'fadeInUp 0.4s ease 0.05s both' }}>
          <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 13, color: T.textSec, textAlign: 'center', lineHeight: '18px' }}>
              Покажи QR другу или отправь ссылку
            </div>

            {/* QR */}
            {user?.id ? (
              <div style={{ background: '#fff', borderRadius: 20, padding: 14, boxShadow: `0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(201,168,76,0.2)` }}>
                <QRCodeSVG
                  value={refLink}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#0F0F1A"
                  level="M"
                />
              </div>
            ) : (
              <div style={{ width: 208, height: 208, borderRadius: 20, background: T.chipBg, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                🔗
              </div>
            )}

            <div style={{ fontSize: 11, color: T.textSec, textAlign: 'center' }}>
              твой ID: {user?.id ?? '—'}
            </div>
          </div>

          {/* Кнопки */}
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={handleShare}
              style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${T.blue}, #2D6FBC)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              📤 Поделиться
            </button>

            <button
              onClick={handleCopy}
              style={{ width: '100%', padding: '14px 0', borderRadius: 16, background: copied ? 'rgba(75,179,75,0.1)' : T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${copied ? 'rgba(75,179,75,0.4)' : T.border}`, color: copied ? T.green : T.textPri, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.25s' }}
            >
              {copied ? '✓ Ссылка скопирована!' : '🔗 Скопировать ссылку'}
            </button>
          </div>
        </div>

        {/* Вехи заданий */}
        <div style={{ marginBottom: 16, animation: 'fadeInUp 0.4s ease 0.1s both' }}>
          <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Награды за приглашения</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MILESTONES.map(m => {
              const done = completedTasks.includes(m.taskId);
              const reached = referralCount >= m.count;
              const canClaim = reached && !done;
              return (
                <div key={m.taskId} style={{ background: done ? 'rgba(75,179,75,0.05)' : canClaim ? 'rgba(201,168,76,0.07)' : T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 16, padding: '14px 16px', border: `1px solid ${done ? 'rgba(75,179,75,0.2)' : canClaim ? 'rgba(201,168,76,0.35)' : T.border}`, display: 'flex', alignItems: 'center', gap: 14, opacity: done ? 0.7 : 1 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: done ? 'rgba(75,179,75,0.15)' : canClaim ? 'rgba(201,168,76,0.15)' : T.chipBg, border: `1px solid ${done ? 'rgba(75,179,75,0.3)' : canClaim ? 'rgba(201,168,76,0.3)' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {done ? '✓' : '👥'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: done ? T.textSec : T.textPri }}>{m.label}</div>
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${Math.min((referralCount / m.count) * 100, 100)}%`, background: done ? `linear-gradient(90deg, ${T.green}, #6FE66F)` : `linear-gradient(90deg, ${T.gold}, ${T.goldL})`, transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ fontSize: 11, color: done ? T.green : T.textSec }}>
                        {done ? 'Выполнено' : `${Math.min(referralCount, m.count)} / ${m.count}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: done ? T.textSec : T.gold, background: done ? T.chipBg : 'rgba(201,168,76,0.12)', border: `1px solid ${done ? T.border : 'rgba(201,168,76,0.3)'}`, borderRadius: 10, padding: '4px 10px' }}>
                    +{m.reward} 🗝️
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Как это работает */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0.15s both' }}>
          <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Как это работает</div>
          <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ padding: '16px', borderBottom: i < STEPS.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {step.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, marginBottom: 3 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: T.textSec, lineHeight: '17px' }}>{step.desc}</div>
                </div>
                <div style={{ fontSize: 18, color: T.border, flexShrink: 0, alignSelf: 'center' }}>{i + 1}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
