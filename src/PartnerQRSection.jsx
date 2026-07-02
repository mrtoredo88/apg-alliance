import React, { useRef, useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { APP_URL } from './constants.js';
import { T, GLASS } from './design.js';

// ─── Poster template settings ───────────────────────────────────────────────
// Update these when the actual template is provided.
// POSTER_QR_CX/CY = center of QR area as fraction of template dimensions
// POSTER_QR_W     = QR width as fraction of template width
const POSTER_QR_CX = 0.5;
const POSTER_QR_CY = 0.72;
const POSTER_QR_W  = 0.30;
const POSTER_TEMPLATE_URL = '/qr-poster-template.png';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = dataUrl;
  a.click();
}

function openPdfWindow(dataUrl, title, subtitle) {
  const win = window.open('', '_blank', 'width=640,height=820');
  if (!win) { alert('Разрешите всплывающие окна для скачивания PDF'); return; }
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>${title}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;background:#fff;font-family:Arial,sans-serif;padding:40px;gap:14px}
      h2{font-size:20px;font-weight:900;text-align:center;color:#0f0f1a;max-width:400px}
      p{font-size:12px;color:#666;text-align:center;max-width:400px;line-height:1.5}
      img.qr{width:260px;height:260px;border:1px solid #ddd;padding:10px}
      .btn{padding:11px 28px;background:#C9A84C;color:#000;border:none;border-radius:8px;
        font-size:14px;font-weight:700;cursor:pointer}
      @media print{.btn{display:none}}
    </style>
  </head><body>
    <h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}
    <img class="qr" src="${dataUrl}" />
    <button class="btn" onclick="window.print()">🖨️ Печать / Сохранить PDF</button>
  </body></html>`);
  win.document.close();
}

function openPosterPdfWindow(posterUrl, partnerName) {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) { alert('Разрешите всплывающие окна для скачивания PDF'); return; }
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>Плакат — ${partnerName}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;background:#fff;font-family:Arial,sans-serif;padding:20px;gap:16px}
      img{max-width:100%;max-height:80vh;object-fit:contain}
      .btn{padding:11px 28px;background:#C9A84C;color:#000;border:none;border-radius:8px;
        font-size:14px;font-weight:700;cursor:pointer}
      @media print{.btn{display:none};@page{margin:0}}
    </style>
  </head><body>
    <img src="${posterUrl}" />
    <button class="btn" onclick="window.print()">🖨️ Печать / Сохранить PDF</button>
  </body></html>`);
  win.document.close();
}

async function buildPoster(partnerName, qrDataUrl) {
  const offscreen = document.createElement('canvas');
  const ctx = offscreen.getContext('2d');

  const drawQR = (W, H) => new Promise(res => {
    const qrSz = Math.round(W * POSTER_QR_W);
    const qrX  = Math.round(W * POSTER_QR_CX - qrSz / 2);
    const qrY  = Math.round(H * POSTER_QR_CY - qrSz / 2);
    const pad  = Math.round(qrSz * 0.07);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - pad, qrY - pad, qrSz + pad * 2, qrSz + pad * 2);
    const img = new Image();
    img.onload  = () => { ctx.drawImage(img, qrX, qrY, qrSz, qrSz); res(offscreen.toDataURL('image/png', 1.0)); };
    img.onerror = () => res(offscreen.toDataURL('image/png', 1.0));
    img.src = qrDataUrl;
  });

  return new Promise(resolve => {
    const tmpl = new Image();
    tmpl.crossOrigin = 'anonymous';

    tmpl.onload = async () => {
      offscreen.width  = tmpl.naturalWidth;
      offscreen.height = tmpl.naturalHeight;
      ctx.drawImage(tmpl, 0, 0);
      resolve(await drawQR(tmpl.naturalWidth, tmpl.naturalHeight));
    };

    tmpl.onerror = async () => {
      // Fallback: dark branded poster (A4 portrait 150 dpi)
      const W = 1240, H = 1754;
      offscreen.width = W; offscreen.height = H;
      ctx.fillStyle = '#0F0F1A';
      ctx.fillRect(0, 0, W, H);
      // Gold frame
      ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 14;
      ctx.strokeRect(44, 44, W - 88, H - 88);
      // Subtitle
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(201,168,76,0.7)'; ctx.font = 'bold 38px Arial';
      ctx.fillText('АЛЬЯНС ПАРТНЁРОВ ГОРОДА · ЗЕЛЕНОГРАД', W / 2, 130);
      // Partner name (word-wrap)
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 72px Arial';
      const words = partnerName.split(' ');
      let line = ''; let y = 260;
      words.forEach(w => {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > W - 200 && line) {
          ctx.fillText(line.trim(), W / 2, y); y += 90; line = w + ' ';
        } else { line = test; }
      });
      if (line.trim()) ctx.fillText(line.trim(), W / 2, y);
      // Footer
      ctx.fillStyle = 'rgba(201,168,76,0.5)'; ctx.font = '32px Arial';
      ctx.fillText('myapg.ru', W / 2, H - 80);
      resolve(await drawQR(W, H));
    };

    tmpl.src = POSTER_TEMPLATE_URL;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PartnerQRSection({ partner }) {
  const publicWrapRef  = useRef(null);
  const serviceWrapRef = useRef(null);
  const [tab,           setTab]    = useState('public');
  const [posterUrl,     setPosterUrl] = useState(null);
  const [posterLoading, setPosterLoading] = useState(false);

  const publicQRValue  = `${APP_URL}/?partner=${partner.id}`;
  const serviceQRValue = partner.id;

  const getCanvasDataUrl = useCallback((wrapRef) => {
    const canvas = wrapRef.current?.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png', 1.0) : null;
  }, []);

  const downloadQRPng = useCallback((wrapRef, name) => {
    const url = getCanvasDataUrl(wrapRef);
    if (url) triggerDownload(url, `${name}-${partner.id}.png`);
  }, [getCanvasDataUrl, partner.id]);

  const downloadQRPdf = useCallback((wrapRef, title, subtitle) => {
    const url = getCanvasDataUrl(wrapRef);
    if (url) openPdfWindow(url, title, subtitle);
  }, [getCanvasDataUrl]);

  const handleGeneratePoster = useCallback(async () => {
    const qrUrl = getCanvasDataUrl(publicWrapRef);
    if (!qrUrl) return;
    setPosterLoading(true);
    try {
      const url = await buildPoster(partner.name, qrUrl);
      setPosterUrl(url);
    } catch { /* fallback already handled inside buildPoster */ }
    finally { setPosterLoading(false); }
  }, [getCanvasDataUrl, partner.name]);

  const TABS = [
    { id: 'public',  label: '🌐 Публичный' },
    { id: 'service', label: '🔑 Служебный' },
    { id: 'poster',  label: '🖼️ Плакат' },
  ];

  const btnRow = { display: 'flex', gap: 8 };
  const btnBase = { flex: 1, padding: '10px 0', borderRadius: 12, border: `1px solid rgba(255,255,255,0.15)`, background: 'rgba(255,255,255,0.07)', color: T.textPri, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
  const btnGold = { ...btnBase, background: `linear-gradient(135deg, #C9A84C, #E4C76B)`, color: '#0F0F1A', border: 'none' };

  return (
    <div>
      {/* Tab row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700,
            background: tab === t.id ? T.gold : T.chipBg,
            color: tab === t.id ? '#0F0F1A' : T.textSec,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Публичный QR ── */}
      {tab === 'public' && (
        <div>
          <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px', marginBottom: 12 }}>
            Размещается на стойке. При сканировании новый пользователь видит регистрацию,
            зарегистрированный — карточку партнёра.{' '}
            <span style={{ color: '#E64646', fontWeight: 700 }}>Ключи не начисляются.</span>
          </div>
          <div ref={publicWrapRef} style={{ display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10 }}>
            <QRCodeCanvas value={publicQRValue} size={200} bgColor="#ffffff" fgColor="#0F0F1A" level="M" includeMargin={false} />
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '7px 11px', fontSize: 10, color: T.textSec, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 12 }}>
            {publicQRValue}
          </div>
          <div style={btnRow}>
            <button style={btnBase} onClick={() => downloadQRPng(publicWrapRef, 'qr-public')}>⬇️ PNG</button>
            <button style={btnGold} onClick={() => downloadQRPdf(publicWrapRef, `Публичный QR — ${partner.name}`, 'Размещается на стойке. Ключи не начисляются.')}>🖨️ PDF</button>
          </div>
        </div>
      )}

      {/* ── Служебный QR ── */}
      {tab === 'service' && (
        <div>
          <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px', marginBottom: 12 }}>
            Используется только после оказания услуги. При сканировании начисляются ключи, штампы и открывается форма отзыва.
          </div>
          <div ref={serviceWrapRef} style={{ display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10 }}>
            <QRCodeCanvas value={serviceQRValue} size={200} bgColor="#ffffff" fgColor="#0F0F1A" level="M" includeMargin={false} />
          </div>
          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '7px 11px', fontSize: 10, color: T.textSec, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 12 }}>
            Код: {serviceQRValue}
          </div>
          <div style={btnRow}>
            <button style={btnBase} onClick={() => downloadQRPng(serviceWrapRef, 'qr-service')}>⬇️ PNG</button>
            <button style={btnGold} onClick={() => downloadQRPdf(serviceWrapRef, `Служебный QR — ${partner.name}`, 'Только после оказания услуги. Начисляет ключи.')}>🖨️ PDF</button>
          </div>
        </div>
      )}

      {/* ── Плакат ── */}
      {tab === 'poster' && (
        <div>
          {/* Скрытый канвас для получения QR data URL при генерации плаката */}
          <div ref={publicWrapRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: -9999 }}>
            <QRCodeCanvas value={publicQRValue} size={200} bgColor="#ffffff" fgColor="#0F0F1A" level="M" includeMargin={false} />
          </div>
          <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px', marginBottom: 12 }}>
            Фирменный плакат с публичным QR. Шаблон: <code style={{ fontSize: 10, color: T.gold }}>/qr-poster-template.png</code>.
            Для замены шаблона положите новый файл с тем же именем.
          </div>
          {!posterUrl ? (
            <button
              onClick={handleGeneratePoster}
              disabled={posterLoading}
              style={{ ...btnGold, width: '100%', padding: '13px 0', fontSize: 13, marginBottom: 4, opacity: posterLoading ? 0.7 : 1 }}
            >
              {posterLoading ? '⏳ Генерация...' : '✨ Сгенерировать плакат'}
            </button>
          ) : (
            <>
              <img src={posterUrl} alt="Плакат" style={{ width: '100%', borderRadius: 12, marginBottom: 10, display: 'block' }} />
              <div style={{ ...btnRow, marginBottom: 8 }}>
                <button style={btnBase} onClick={() => triggerDownload(posterUrl, `poster-${partner.id}.png`)}>⬇️ PNG</button>
                <button style={btnGold} onClick={() => openPosterPdfWindow(posterUrl, partner.name)}>🖨️ PDF</button>
              </div>
              <button onClick={() => setPosterUrl(null)} style={{ ...btnBase, width: '100%', fontSize: 11 }}>↺ Перегенерировать</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
