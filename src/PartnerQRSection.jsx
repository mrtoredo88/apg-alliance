import React, { useRef, useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { APP_URL } from './constants.js';
import { T } from './design.js';

const POSTER_TEMPLATE_URL = '/qr-poster-template-v3.jpg';

function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = dataUrl;
  a.click();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPdfSize(options) {
  const preset = options?.format === 'A5'
    ? { width: 148, height: 210 }
    : { width: 210, height: 297 };
  return options?.orientation === 'landscape'
    ? { width: preset.height, height: preset.width }
    : preset;
}

function buildPrintHtml({ imageUrl, title, subtitle, type = 'poster', options }) {
  const size = getPdfSize(options);
  const margin = Number(options?.marginMm ?? 8);
  const quality = Number(options?.quality ?? 100);
  const imageFit = type === 'poster' ? 'contain' : 'none';
  const qrSize = type === 'qr' ? Math.min(size.width, size.height) * 0.46 : null;
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: ${size.width}mm ${size.height}mm; margin: ${margin}mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #f4f1e8; font-family: Arial, sans-serif; }
      .toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; align-items: center; justify-content: center; padding: 12px; background: rgba(15,15,26,.92); color: #fff; }
      .toolbar button { border: 0; border-radius: 10px; padding: 10px 14px; background: #C9A84C; color: #0F0F1A; font-weight: 800; cursor: pointer; }
      .hint { font-size: 12px; opacity: .78; }
      .sheet-wrap { min-height: calc(100vh - 62px); display: grid; place-items: center; padding: 18px; }
      .sheet { width: ${size.width}mm; height: ${size.height}mm; padding: ${margin}mm; background: #fff; box-shadow: 0 18px 60px rgba(0,0,0,.22); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6mm; overflow: hidden; }
      h1 { margin: 0; max-width: 100%; text-align: center; color: #0F0F1A; font-size: ${type === 'poster' ? 14 : 18}pt; line-height: 1.15; font-weight: 900; }
      p { margin: 0; max-width: 82%; text-align: center; color: #59564d; font-size: 9pt; line-height: 1.45; }
      img.poster { width: 100%; height: 100%; object-fit: ${imageFit}; image-rendering: auto; }
      img.qr { width: ${qrSize ?? 0}mm; height: ${qrSize ?? 0}mm; object-fit: contain; image-rendering: pixelated; border: .5mm solid #ece6d5; padding: 4mm; }
      @media print {
        html, body { background: #fff; }
        .toolbar { display: none; }
        .sheet-wrap { display: block; min-height: 0; padding: 0; }
        .sheet { width: auto; height: auto; min-height: calc(${size.height}mm - ${margin * 2}mm); padding: 0; box-shadow: none; page-break-after: avoid; }
        img.poster { max-width: 100%; max-height: calc(${size.height}mm - ${margin * 2}mm); }
      }
    </style>
  </head><body>
    <div class="toolbar">
      <button onclick="window.print()">Сохранить в PDF</button>
      <span class="hint">${options?.format ?? 'A4'} · ${options?.orientation === 'landscape' ? 'горизонтально' : 'вертикально'} · поля ${margin} мм · качество ${quality}%</span>
    </div>
    <main class="sheet-wrap">
      <section class="sheet">
        ${type === 'poster'
          ? `<img class="poster" src="${imageUrl}" alt="${escapeHtml(title)}">`
          : `<h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}<img class="qr" src="${imageUrl}" alt="QR">`}
      </section>
    </main>
  </body></html>`;
}

function openPrintDocument(html) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100');
  if (!win) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    triggerDownload(URL.createObjectURL(blob), 'apg-pdf-preview.html');
    alert('Открылся fallback-файл. Откройте его и выберите «Печать / Сохранить в PDF».');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function detectWhiteRegion(ctx, W, H) {
  const data = ctx.getImageData(0, 0, W, H).data;
  const GRID = 32, step = 2;
  const cW = W / GRID, cH = H / GRID;

  const findCluster = (threshold) => {
    const pct = new Float32Array(GRID * GRID);
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const x0 = Math.floor(gx * cW), x1 = Math.floor((gx + 1) * cW);
        const y0 = Math.floor(gy * cH), y1 = Math.floor((gy + 1) * cH);
        let white = 0, total = 0;
        for (let y = y0; y < y1; y += step) {
          for (let x = x0; x < x1; x += step) {
            const i = (y * W + x) * 4;
            if (data[i + 3] > 200) {
              total++;
              if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) white++;
            }
          }
        }
        pct[gy * GRID + gx] = total > 0 ? white / total : 0;
      }
    }

    const visited = new Uint8Array(GRID * GRID);
    let bestCells = null, bestScore = -1;

    for (let start = 0; start < GRID * GRID; start++) {
      if (pct[start] < threshold || visited[start]) continue;
      const queue = [start];
      visited[start] = 1;
      const cells = [start];
      let qi = 0;
      while (qi < queue.length) {
        const idx = queue[qi++];
        const gy = (idx / GRID) | 0, gx = idx % GRID;
        const nbrs = [
          gy > 0 ? idx - GRID : -1,
          gy < GRID - 1 ? idx + GRID : -1,
          gx > 0 ? idx - 1 : -1,
          gx < GRID - 1 ? idx + 1 : -1,
        ];
        for (const ni of nbrs) {
          if (ni >= 0 && !visited[ni] && pct[ni] >= threshold) {
            visited[ni] = 1;
            queue.push(ni);
            cells.push(ni);
          }
        }
      }
      let mnGx = GRID, mxGx = 0, mnGy = GRID, mxGy = 0;
      for (const idx of cells) {
        const gy = (idx / GRID) | 0, gx = idx % GRID;
        if (gx < mnGx) mnGx = gx; if (gx > mxGx) mxGx = gx;
        if (gy < mnGy) mnGy = gy; if (gy > mxGy) mxGy = gy;
      }
      const bw = (mxGx - mnGx + 1) * cW, bh = (mxGy - mnGy + 1) * cH;
      const sq = Math.min(bw, bh) / Math.max(bw, bh);
      const score = sq * sq * cells.length;
      if (score > bestScore) { bestScore = score; bestCells = cells; }
    }

    if (!bestCells || bestCells.length < 4) return null;
    let minGx = GRID, maxGx = 0, minGy = GRID, maxGy = 0;
    for (const idx of bestCells) {
      const gy = (idx / GRID) | 0, gx = idx % GRID;
      if (gx < minGx) minGx = gx;
      if (gx > maxGx) maxGx = gx;
      if (gy < minGy) minGy = gy;
      if (gy > maxGy) maxGy = gy;
    }
    const w = (maxGx - minGx + 1) * cW;
    const h = (maxGy - minGy + 1) * cH;
    if (w < W * 0.05 || h < H * 0.05) return null;
    return {
      cx: ((minGx + maxGx + 1) / 2) * cW,
      cy: ((minGy + maxGy + 1) / 2) * cH,
      w, h,
    };
  };

  return findCluster(0.97) || findCluster(0.80);
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
    const size = Math.round(Math.min(W, H) * 0.30);
    const cx = W * 0.5;
    const cy = H * 0.65;
    const pad = Math.round(size * 0.10);
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
        const size = Math.round(Math.min(region.w, region.h) * 0.80);
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
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfOptions, setPdfOptions] = useState({ format: 'A4', orientation: 'portrait', marginMm: 6, quality: 100 });
  const [copied, setCopied]       = useState(null);

  const getCanvasDataUrl = useCallback((wrapRef) => {
    const canvas = wrapRef.current?.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png', 1.0) : null;
  }, []);

  const downloadPng = useCallback((wrapRef, prefix) => {
    const url = getCanvasDataUrl(wrapRef);
    if (url) triggerDownload(url, `${prefix}-${entityId}.png`);
  }, [getCanvasDataUrl, entityId]);

  const openPdfPreview = useCallback(({ imageUrl, title, subtitle = '', type = 'qr' }) => {
    setPdfPreview({ imageUrl, title, subtitle, type });
  }, []);

  const printPdfPreview = useCallback(() => {
    if (!pdfPreview?.imageUrl) return;
    openPrintDocument(buildPrintHtml({ ...pdfPreview, options: pdfOptions }));
  }, [pdfOptions, pdfPreview]);

  const downloadPdf = useCallback((wrapRef, title, sub) => {
    const url = getCanvasDataUrl(wrapRef);
    if (url) openPdfPreview({ imageUrl: url, title, subtitle: sub, type: 'qr' });
  }, [getCanvasDataUrl, openPdfPreview]);

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

  const optionButton = (active) => ({
    padding: '8px 10px',
    borderRadius: 10,
    border: active ? '1px solid rgba(201,168,76,0.72)' : '1px solid rgba(255,255,255,0.14)',
    background: active ? 'rgba(201,168,76,0.22)' : 'rgba(255,255,255,0.07)',
    color: active ? T.gold : T.textSec,
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
  });

  const PdfPreviewModal = () => {
    if (!pdfPreview) return null;
    const size = getPdfSize(pdfOptions);
    const isPoster = pdfPreview.type === 'poster';
    return (
      <div
        onClick={e => { if (e.target === e.currentTarget) setPdfPreview(null); }}
        style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', padding: '18px 14px 34px', overflowY: 'auto' }}
      >
        <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', display: 'grid', gap: 12 }}>
          <div style={{ background: 'rgba(18,18,28,0.92)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 20, padding: 14, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ color: T.textPri, fontSize: 16, fontWeight: 900 }}>Preview PDF</div>
                <div style={{ color: T.textSec, fontSize: 11, marginTop: 3 }}>Проверьте пропорции перед сохранением.</div>
              </div>
              <button onClick={() => setPdfPreview(null)} style={{ width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: T.textPri, fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {['A4', 'A5'].map(format => (
                <button key={format} onClick={() => setPdfOptions(prev => ({ ...prev, format }))} style={optionButton(pdfOptions.format === format)}>{format}</button>
              ))}
              <button onClick={() => setPdfOptions(prev => ({ ...prev, orientation: 'portrait' }))} style={optionButton(pdfOptions.orientation === 'portrait')}>Вертикально</button>
              <button onClick={() => setPdfOptions(prev => ({ ...prev, orientation: 'landscape' }))} style={optionButton(pdfOptions.orientation === 'landscape')}>Горизонтально</button>
            </div>

            <label style={{ display: 'grid', gap: 6, color: T.textSec, fontSize: 11, fontWeight: 700 }}>
              Поля: {pdfOptions.marginMm} мм
              <input type="range" min="0" max="20" value={pdfOptions.marginMm} onChange={e => setPdfOptions(prev => ({ ...prev, marginMm: Number(e.target.value) }))} />
            </label>
            <label style={{ display: 'grid', gap: 6, color: T.textSec, fontSize: 11, fontWeight: 700 }}>
              Качество: {pdfOptions.quality}%
              <input type="range" min="70" max="100" step="5" value={pdfOptions.quality} onChange={e => setPdfOptions(prev => ({ ...prev, quality: Number(e.target.value) }))} />
            </label>
            <button onClick={printPdfPreview} style={{ ...btnGold, width: '100%', flex: 'unset', padding: '13px 0' }}>Сохранить в PDF</button>
          </div>

          <div style={{ display: 'grid', placeItems: 'center', padding: 12, background: '#e9e2d2', borderRadius: 18 }}>
            <div style={{
              width: `min(100%, ${size.width * 1.7}px)`,
              aspectRatio: `${size.width} / ${size.height}`,
              background: '#fff',
              padding: `${pdfOptions.marginMm / 2}px`,
              boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}>
              {isPoster ? (
                <img src={pdfPreview.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              ) : (
                <div style={{ textAlign: 'center', display: 'grid', placeItems: 'center', gap: 10 }}>
                  <div style={{ color: '#0F0F1A', fontSize: 18, fontWeight: 900 }}>{pdfPreview.title}</div>
                  {pdfPreview.subtitle && <div style={{ color: '#5d584f', fontSize: 12, lineHeight: '17px' }}>{pdfPreview.subtitle}</div>}
                  <img src={pdfPreview.imageUrl} alt="" style={{ width: 'min(58vw, 220px)', maxWidth: '72%', aspectRatio: '1', objectFit: 'contain', imageRendering: 'pixelated', border: '1px solid #eee', padding: 10 }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          <div style={{ fontSize: 11, color: T.textSec, lineHeight: '17px', marginBottom: 10 }}>
            Фирменный плакат АПГ с публичным QR-кодом — готов к размещению и печати.
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
                <button style={btnGold} onClick={() => openPdfPreview({ imageUrl: posterUrl, title: `Плакат — ${entityName}`, type: 'poster' })}>🖨️ PDF</button>
              </div>
              <button onClick={() => setPosterUrl(null)} style={{ ...btnBase, width: '100%', fontSize: 11 }}>↺ Перегенерировать</button>
            </>
          )}
        </div>
      )}
      <PdfPreviewModal />
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
