import React, { useRef, useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { APP_URL } from './constants.js';
import { T } from './design.js';

const POSTER_QR_CX = 0.5;
const POSTER_QR_CY = 0.72;
const POSTER_QR_W  = 0.30;
const POSTER_TEMPLATE_URL = '/qr-poster-template.png';

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

function openPosterPdfWindow(posterUrl, entityName) {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) { alert('Разрешите всплывающие окна для скачивания PDF'); return; }
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>Плакат — ${entityName}</title>
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

function detectWhiteRegion(ctx, W, H) {
  const data = ctx.getImageData(0, 0, W, H).data;
  const GRID = 32, step = 3;
  const cW = W / GRID, cH = H / GRID;
  let minCx = W, minCy = H, maxCx = 0, maxCy = 0, found = false;

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let white = 0, total = 0;
      const x0 = Math.floor(gx * cW), x1 = Math.floor((gx + 1) * cW);
      const y0 = Math.floor(gy * cH), y1 = Math.floor((gy + 1) * cH);
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const i = (y * W + x) * 4;
          if (data[i + 3] > 200) {
            total++;
            if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) white++;
          }
        }
      }
      if (total > 0 && white / total >= 0.7) {
        const cx = (gx + 0.5) * cW, cy = (gy + 0.5) * cH;
        if (cx < minCx) minCx = cx;
        if (cx > maxCx) maxCx = cx;
        if (cy < minCy) minCy = cy;
        if (cy > maxCy) maxCy = cy;
        found = true;
      }
    }
  }

  if (!found) return null;
  const w = maxCx - minCx, h = maxCy - minCy;
  if (w < W * 0.05 || h < H * 0.05) return null;
  return { cx: (minCx + maxCx) / 2, cy: (minCy + maxCy) / 2, w, h };
}

async function buildPoster(entityName, qrDataUrl) {
  const offscreen = document.createElement('canvas');
  const ctx = offscreen.getContext('2d');

  const placeQR = (cx, cy, size) => new Promise(res => {
    const img = new Image();
    img.onload  = () => { ctx.drawImage(img, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size); res(offscreen.toDataURL('image/png', 1.0)); };
    img.onerror = () => res(offscreen.toDataURL('image/png', 1.0));
    img.src = qrDataUrl;
  });

  const drawQRFallback = (W, H) => {
    const size = Math.round(W * POSTER_QR_W);
    const cx = W * POSTER_QR_CX;
    const cy = H * POSTER_QR_CY;
    const pad = Math.round(size * 0.07);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(cx - size / 2) - pad, Math.round(cy - size / 2) - pad, size + pad * 2, size + pad * 2);
    return placeQR(cx, cy, size);
  };

  return new Promise(resolve => {
    const tmpl = new Image();
    tmpl.crossOrigin = 'anonymous';

    tmpl.onload = async () => {
      offscreen.width  = tmpl.naturalWidth;
      offscreen.height = tmpl.naturalHeight;
      ctx.drawImage(tmpl, 0, 0);
      const region = detectWhiteRegion(ctx, offscreen.width, offscreen.height);
      if (region) {
        const size = Math.round(Math.min(region.w, region.h) * 0.82);
        resolve(await placeQR(region.cx, region.cy, size));
      } else {
        resolve(await drawQRFallback(offscreen.width, offscreen.height));
      }
    };

    tmpl.onerror = async () => {
      const W = 1240, H = 1754;
      offscreen.width = W; offscreen.height = H;
      ctx.fillStyle = '#0F0F1A';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 14;
      ctx.strokeRect(44, 44, W - 88, H - 88);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(201,168,76,0.7)'; ctx.font = 'bold 38px Arial';
      ctx.fillText('АЛЬЯНС ПАРТНЁРОВ ГОРОДА · ЗЕЛЕНОГРАД', W / 2, 130);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 72px Arial';
      const words = entityName.split(' ');
      let line = ''; let y = 260;
      words.forEach(w => {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > W - 200 && line) {
          ctx.fillText(line.trim(), W / 2, y); y += 90; line = w + ' ';
        } else { line = test; }
      });
      if (line.trim()) ctx.fillText(line.trim(), W / 2, y);
      ctx.fillStyle = 'rgba(201,168,76,0.5)'; ctx.font = '32px Arial';
      ctx.fillText('myapg.ru', W / 2, H - 80);
      resolve(await drawQRFallback(W, H));
    };

    tmpl.src = POSTER_TEMPLATE_URL;
  });
}

// ─── Generic cabinet QR section ───────────────────────────────────────────────
// qr1 / qr2 = { tabLabel, value, linkText, desc, downloadPrefix, pdfTitle, pdfSub }
export function CabinetQRSection({ entityId, entityName, qr1, qr2 }) {
  const qr1WrapRef = useRef(null);
  const qr2WrapRef = useRef(null);
  const [tab, setTab]             = useState('qr1');
  const [posterUrl, setPosterUrl] = useState(null);
  const [posterLoading, setPosterLoading] = useState(false);
  const [copied, setCopied]       = useState(null);

  const getCanvasDataUrl = useCallback((wrapRef) => {
    const canvas = wrapRef.current?.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png', 1.0) : null;
  }, []);

  const downloadPng = useCallback((wrapRef, prefix) => {
    const url = getCanvasDataUrl(wrapRef);
    if (url) triggerDownload(url, `${prefix}-${entityId}.png`);
  }, [getCanvasDataUrl, entityId]);

  const downloadPdf = useCallback((wrapRef, title, sub) => {
    const url = getCanvasDataUrl(wrapRef);
    if (url) openPdfWindow(url, title, sub);
  }, [getCanvasDataUrl]);

  const copyLink = useCallback((text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleGeneratePoster = useCallback(async () => {
    const qrUrl = getCanvasDataUrl(qr1WrapRef);
    if (!qrUrl) return;
    setPosterLoading(true);
    try {
      const url = await buildPoster(entityName, qrUrl);
      setPosterUrl(url);
    } catch {}
    finally { setPosterLoading(false); }
  }, [getCanvasDataUrl, entityName]);

  const TABS = [
    { id: 'qr1',    label: qr1.tabLabel },
    { id: 'qr2',    label: qr2.tabLabel },
    { id: 'poster', label: '🖼️ Плакат' },
  ];

  const btnBase = { flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: T.textPri, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
  const btnGold = { ...btnBase, background: 'linear-gradient(135deg, #C9A84C, #E4C76B)', color: '#0F0F1A', border: 'none' };
  const btnCopy = { width: '100%', padding: '10px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: T.textPri, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 6 };

  const QRBlock = ({ wrapRef, value, linkText, desc, downloadPrefix, pdfTitle, pdfSub, copyKey }) => (
    <div>
      <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px', marginBottom: 12 }}>{desc}</div>
      <div ref={wrapRef} style={{ display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10 }}>
        <QRCodeCanvas value={value} size={200} bgColor="#ffffff" fgColor="#0F0F1A" level="M" includeMargin={false} />
      </div>
      <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '7px 11px', fontSize: 10, color: T.textSec, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 4 }}>
        {linkText}
      </div>
      <button style={{ ...btnCopy, color: copied === copyKey ? T.green : T.textPri }} onClick={() => copyLink(linkText, copyKey)}>
        {copied === copyKey ? '✓ Скопировано' : '📋 Скопировать ссылку'}
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={btnBase} onClick={() => downloadPng(wrapRef, downloadPrefix)}>⬇️ PNG</button>
        <button style={btnGold} onClick={() => downloadPdf(wrapRef, pdfTitle, pdfSub)}>🖨️ PDF</button>
      </div>
    </div>
  );

  return (
    <div>
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

      {tab === 'qr1' && (
        <QRBlock
          wrapRef={qr1WrapRef} value={qr1.value} linkText={qr1.linkText}
          desc={qr1.desc} downloadPrefix={qr1.downloadPrefix}
          pdfTitle={qr1.pdfTitle} pdfSub={qr1.pdfSub} copyKey="qr1"
        />
      )}

      {tab === 'qr2' && (
        <QRBlock
          wrapRef={qr2WrapRef} value={qr2.value} linkText={qr2.linkText}
          desc={qr2.desc} downloadPrefix={qr2.downloadPrefix}
          pdfTitle={qr2.pdfTitle} pdfSub={qr2.pdfSub} copyKey="qr2"
        />
      )}

      {tab === 'poster' && (
        <div>
          <div ref={qr1WrapRef} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', top: -9999 }}>
            <QRCodeCanvas value={qr1.value} size={200} bgColor="#ffffff" fgColor="#0F0F1A" level="M" includeMargin={false} />
          </div>
          <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px', marginBottom: 12 }}>
            Фирменный плакат с публичным QR. Шаблон: <code style={{ fontSize: 10, color: T.gold }}>/qr-poster-template.png</code>.
          </div>
          {!posterUrl ? (
            <button onClick={handleGeneratePoster} disabled={posterLoading}
              style={{ ...btnGold, width: '100%', padding: '13px 0', fontSize: 13, marginBottom: 4, opacity: posterLoading ? 0.7 : 1 }}>
              {posterLoading ? '⏳ Генерация...' : '✨ Сгенерировать плакат'}
            </button>
          ) : (
            <>
              <img src={posterUrl} alt="Плакат" style={{ width: '100%', borderRadius: 12, marginBottom: 10, display: 'block' }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button style={btnBase} onClick={() => triggerDownload(posterUrl, `poster-${entityId}.png`)}>⬇️ PNG</button>
                <button style={btnGold} onClick={() => openPosterPdfWindow(posterUrl, entityName)}>🖨️ PDF</button>
              </div>
              <button onClick={() => setPosterUrl(null)} style={{ ...btnBase, width: '100%', fontSize: 11 }}>↺ Перегенерировать</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Partner wrapper (backward compat) ────────────────────────────────────────
export function PartnerQRSection({ partner }) {
  const publicVal = `${APP_URL}/?partner=${partner.id}`;
  return (
    <CabinetQRSection
      entityId={partner.id}
      entityName={partner.name}
      qr1={{
        tabLabel: '🌐 Публичный',
        value: publicVal,
        linkText: publicVal,
        desc: 'Размещается на стойке. При сканировании новый пользователь видит регистрацию, зарегистрированный — карточку партнёра. Ключи не начисляются.',
        downloadPrefix: 'qr-public',
        pdfTitle: `Публичный QR — ${partner.name}`,
        pdfSub: 'Размещается на стойке. Ключи не начисляются.',
      }}
      qr2={{
        tabLabel: '🔑 Служебный',
        value: partner.id,
        linkText: `Код: ${partner.id}`,
        desc: 'Используется только после оказания услуги. При сканировании начисляются ключи, штампы и открывается форма отзыва.',
        downloadPrefix: 'qr-service',
        pdfTitle: `Служебный QR — ${partner.name}`,
        pdfSub: 'Только после оказания услуги. Начисляет ключи.',
      }}
    />
  );
}

// ─── Expert wrapper ────────────────────────────────────────────────────────────
export function ExpertQRSection({ expert }) {
  const publicVal  = `${APP_URL}/?expert=${expert.id}`;
  const serviceVal = `expert_${expert.id}`;
  const serviceLink = `${APP_URL}/?scan=${serviceVal}`;
  return (
    <CabinetQRSection
      entityId={expert.id}
      entityName={expert.name}
      qr1={{
        tabLabel: '🌐 Публичный',
        value: publicVal,
        linkText: publicVal,
        desc: 'Для приглашения клиентов в АПГ. При сканировании открывается профиль эксперта. Ключи не начисляются.',
        downloadPrefix: 'qr-expert-public',
        pdfTitle: `Публичный QR — ${expert.name}`,
        pdfSub: 'Для приглашения клиентов. Ключи не начисляются.',
      }}
      qr2={{
        tabLabel: '🔑 Служебный',
        value: serviceVal,
        linkText: serviceLink,
        desc: 'Предъявляется клиентом после оказания услуги. Начисляет ключи и открывает форму отзыва.',
        downloadPrefix: 'qr-expert-service',
        pdfTitle: `Служебный QR — ${expert.name}`,
        pdfSub: 'После оказания услуги. Начисляет ключи.',
      }}
    />
  );
}
