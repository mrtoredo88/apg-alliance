import React, { useState, useRef, useEffect, useCallback } from 'react';
import { T } from './design.js';

const SPINNER = (
  <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }} />
);

export function EmailAuth({ onCancel }) {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  const sendCode = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/email-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || 'Ошибка отправки');
      } else {
        setStep('code');
        startCooldown();
        setTimeout(() => inputRefs.current[0]?.focus(), 150);
      }
    } catch {
      setError('Ошибка сети. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  }, [email, startCooldown]);

  const verifyCode = useCallback(async (codeStr) => {
    setLoading(true);
    setError('');
    const ref = localStorage.getItem('apg_pending_ref') ?? undefined;
    try {
      const res = await fetch('/api/email-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email, code: codeStr, ref }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || 'Неверный код');
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      } else {
        if (ref) localStorage.removeItem('apg_pending_ref');
        localStorage.setItem('apg_email_user', JSON.stringify(data.user));
        window.location.reload();
      }
    } catch {
      setError('Ошибка сети. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleDigit = (idx, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError('');

    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }

    const full = next.join('');
    if (full.length === 6 && next.every(d => d !== '')) {
      verifyCode(full);
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      verifyCode(pasted);
    }
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const inputBase = {
    background: T.chipBg,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    color: T.textPri,
    outline: 'none',
    fontFamily: 'inherit',
  };

  if (step === 'email') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && isEmailValid && !loading && sendCode()}
          placeholder="Ваш email"
          style={{ ...inputBase, width: '100%', padding: '12px 14px', fontSize: 15, boxSizing: 'border-box' }}
        />
        {error && <div style={{ fontSize: 12, color: '#E64646', textAlign: 'center' }}>{error}</div>}
        <button
          onClick={sendCode}
          disabled={loading || !isEmailValid}
          style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: loading || !isEmailValid ? 'default' : 'pointer', background: loading || !isEmailValid ? 'rgba(74,144,217,0.3)' : 'linear-gradient(135deg, #4A90D9, #2D6FBC)', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {loading ? SPINNER : '✉️ Получить код'}
        </button>
        <button
          onClick={onCancel}
          style={{ width: '100%', padding: '10px 0', borderRadius: 12, background: 'none', border: `1px solid ${T.border}`, color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Отмена
        </button>
      </div>
    );
  }

  // step === 'code'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', alignItems: 'center' }}>
      <div style={{ fontSize: 13, color: T.textSec, textAlign: 'center', lineHeight: '18px' }}>
        Код отправлен на <span style={{ color: T.textPri, fontWeight: 600 }}>{email}</span>
      </div>

      {/* 6 цифровых полей */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', width: '100%', maxWidth: 300 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            style={{
              ...inputBase,
              flex: 1, minWidth: 0, height: 52,
              textAlign: 'center',
              fontSize: 22, fontWeight: 800,
              border: `1.5px solid ${d ? T.blue : T.border}`,
              transition: 'border-color 0.15s',
              opacity: loading ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {error && <div style={{ fontSize: 12, color: '#E64646', textAlign: 'center' }}>{error}</div>}
      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textSec, fontSize: 13 }}>{SPINNER} Проверяем...</div>}

      <button
        onClick={() => { setStep('email'); setDigits(['', '', '', '', '', '']); setError(''); }}
        style={{ background: 'none', border: 'none', color: T.blue, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '2px 0' }}
      >
        ← Изменить email
      </button>

      {cooldown > 0
        ? <div style={{ fontSize: 12, color: T.textSec }}>Повторный запрос через {cooldown} с</div>
        : <button
            onClick={sendCode}
            disabled={loading}
            style={{ background: 'none', border: 'none', color: T.blue, fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', padding: '2px 0' }}
          >
            Отправить код повторно
          </button>
      }
    </div>
  );
}
