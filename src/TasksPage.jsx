import React, { useState } from 'react';
import { Panel } from '@vkontakte/vkui';
import { TASKS } from './tasks.js';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  green:   '#4BB34B',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

const GLASS = {
  background: 'rgba(255,255,255,0.07)',
  backdropFilter: 'blur(28px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
  border: '1px solid rgba(255,255,255,0.13)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.08)',
};

function TaskCard({ task, status, onClaim, claiming }) {
  const pct = task.total
    ? Math.round((status.prog / task.total) * 100)
    : 0;

  const borderColor = status.done
    ? 'rgba(75,179,75,0.2)'
    : status.ready
    ? 'rgba(201,168,76,0.4)'
    : T.border;

  const bg = status.done
    ? 'rgba(75,179,75,0.05)'
    : status.ready
    ? 'rgba(201,168,76,0.07)'
    : 'rgba(255,255,255,0.07)';

  return (
    <div style={{
      background: bg, backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
      borderRadius: 24, padding: 16, marginBottom: 10,
      border: `1px solid ${borderColor}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      animation: 'fadeInUp 0.35s ease both',
      opacity: status.done ? 0.65 : 1,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Золотое свечение для готовых к получению */}
      {status.ready && (
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12), transparent 70%)', pointerEvents: 'none' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Иконка */}
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: status.done
            ? 'rgba(75,179,75,0.12)'
            : status.ready
            ? 'rgba(201,168,76,0.15)'
            : 'rgba(255,255,255,0.05)',
          border: `1px solid ${status.done ? 'rgba(75,179,75,0.3)' : status.ready ? 'rgba(201,168,76,0.35)' : T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: status.done ? 20 : 24,
          position: 'relative',
        }}>
          {status.done ? '✓' : task.emoji}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: status.done ? T.textSec : T.textPri, lineHeight: '18px' }}>
              {task.title}
            </div>
            {/* Награда */}
            <div style={{
              flexShrink: 0, fontSize: 11, fontWeight: 800,
              color: status.done ? T.textSec : T.gold,
              background: status.done ? 'rgba(255,255,255,0.05)' : 'rgba(201,168,76,0.12)',
              border: `1px solid ${status.done ? T.border : 'rgba(201,168,76,0.3)'}`,
              borderRadius: 10, padding: '3px 8px',
            }}>
              +{task.reward} 🗝️
            </div>
          </div>

          <div style={{ fontSize: 12, color: T.textSec, marginBottom: task.total ? 10 : 0, lineHeight: '16px' }}>
            {task.desc}
          </div>

          {/* Прогресс-бар */}
          {task.total && !status.done && (
            <div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${pct}%`,
                  background: status.ready
                    ? `linear-gradient(90deg, ${T.gold}, ${T.goldL})`
                    : 'rgba(255,255,255,0.2)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: status.ready ? T.gold : T.textSec, fontWeight: 600 }}>
                {status.prog} / {task.total}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Кнопка "Забрать" */}
      {status.ready && (
        <button
          onClick={() => onClaim(task.id, task.reward)}
          disabled={claiming === task.id}
          style={{
            width: '100%', marginTop: 12, padding: '12px 0', borderRadius: 14, border: 'none',
            background: claiming === task.id
              ? 'rgba(255,255,255,0.08)'
              : `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
            color: claiming === task.id ? T.textSec : '#0F0F1A',
            fontSize: 14, fontWeight: 800, cursor: claiming === task.id ? 'default' : 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          {claiming === task.id ? 'Получаем...' : `🎁 Забрать +${task.reward} ключей`}
        </button>
      )}
    </div>
  );
}

export function TasksPage({ userKeys = 0, favCount = 0, referralCount = 0, streak = 0, completedTasks = [], onClaim, onBack }) {
  const [claiming, setClaiming] = useState(null);

  const handleClaim = async (taskId, reward) => {
    setClaiming(taskId);
    try { await onClaim(taskId, reward); }
    finally { setClaiming(null); }
  };

  const statuses = TASKS.map(t => ({
    ...t,
    done:  completedTasks.includes(t.id),
    ready: t.check(userKeys, favCount, referralCount, streak) && !completedTasks.includes(t.id),
    prog:  t.progress ? t.progress(userKeys, favCount, referralCount, streak) : 0,
  }));

  const claimable   = statuses.filter(s => s.ready);
  const inProgress  = statuses.filter(s => !s.done && !s.ready);
  const done        = statuses.filter(s => s.done);

  const totalKeys = TASKS.reduce((s, t) => s + t.reward, 0);
  const earnedKeys = done.reduce((s, t) => s + t.reward, 0);

  return (
    <Panel id="tasks">
      {/* Кастомный хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0,
          }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>
              ✦ Задания
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>
              {done.length} / {TASKS.length} выполнено · {earnedKeys} из {totalKeys} 🗝️
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: T.bg, minHeight: '100%', padding: '12px 16px 90px' }}>

        {/* Прогресс */}
        <div style={{ ...GLASS, borderRadius: 24, padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: T.textSec }}>Выполнено заданий</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{done.length} / {TASKS.length}</div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.round((done.length / TASKS.length) * 100)}%`,
              background: `linear-gradient(90deg, ${T.gold}, ${T.goldL})`,
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ fontSize: 12, color: T.textSec }}>
            Заработано ключей за задания: <span style={{ color: T.gold, fontWeight: 700 }}>{earnedKeys} из {totalKeys}</span>
          </div>
        </div>

        {/* Доступны для получения */}
        {claimable.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>✦ Готовы к получению</div>
            {claimable.map(s => (
              <TaskCard key={s.id} task={s} status={s} onClaim={handleClaim} claiming={claiming} />
            ))}
          </>
        )}

        {/* В процессе */}
        {inProgress.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: T.textSec, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: claimable.length > 0 ? 12 : 0 }}>В процессе</div>
            {inProgress.map(s => (
              <TaskCard key={s.id} task={s} status={s} onClaim={handleClaim} claiming={claiming} />
            ))}
          </>
        )}

        {/* Выполнены */}
        {done.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: T.textSec, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 }}>Выполнено</div>
            {done.map(s => (
              <TaskCard key={s.id} task={s} status={s} onClaim={handleClaim} claiming={claiming} />
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
