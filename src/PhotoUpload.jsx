import { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';

const ACCEPT = 'image/jpeg,image/png,image/webp';

export default function PhotoUpload({ value, onChange, folder, label = 'Загрузить фото', theme }) {
  const inputRef = useRef();
  const [progress, setProgress] = useState(null);
  const [dragging, setDragging] = useState(false);

  const T = theme ?? {
    chipBg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.12)',
    textSec: 'rgba(255,255,255,0.5)',
    gold: '#C9A84C',
  };

  async function upload(file) {
    if (!file) return;
    setProgress(0);

    let compressed;
    try {
      compressed = await imageCompression(file, {
        maxWidthOrHeight: 1920,
        initialQuality: 0.85,
        fileType: 'image/webp',
        useWebWorker: true,
        onProgress: p => setProgress(Math.round(p * 0.4)),
      });
    } catch {
      compressed = file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const res = await fetch('/api/upload-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, filename: baseName, contentType: compressed.type }),
    });
    if (!res.ok) { setProgress(null); return; }
    const { signedUrl, publicUrl } = await res.json();

    setProgress(50);

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', compressed.type);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(50 + Math.round((e.loaded / e.total) * 50));
    };
    await new Promise((resolve, reject) => {
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject());
      xhr.onerror = reject;
      xhr.send(compressed);
    });

    setProgress(null);
    onChange(publicUrl);
  }

  function onFileChange(e) { upload(e.target.files[0]); }
  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    upload(e.dataTransfer.files[0]);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {value ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={value} alt=""
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
              border: `2px solid ${T.gold}`, display: 'block' }}
          />
          <button
            onClick={() => onChange('')}
            style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22,
              borderRadius: '50%', border: 'none', background: '#E64646', color: '#fff',
              fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', lineHeight: 1 }}
          >✕</button>
          <button
            onClick={() => inputRef.current.click()}
            style={{ marginTop: 8, fontSize: 12, background: 'none', border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.textSec, padding: '4px 10px', cursor: 'pointer', display: 'block' }}
          >Заменить</button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{ border: `2px dashed ${dragging ? T.gold : T.border}`, borderRadius: 14,
            padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? `${T.gold}11` : T.chipBg, transition: 'all 0.2s' }}
        >
          <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
          <div style={{ fontSize: 13, color: T.textSec }}>{label}</div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>JPG, PNG, WebP</div>
        </div>
      )}

      {progress !== null && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: T.gold,
              width: `${progress}%`, transition: 'width 0.2s' }} />
          </div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>
            {progress < 45 ? 'Сжатие...' : `Загрузка ${progress}%`}
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} onChange={onFileChange}
        style={{ display: 'none' }} />
    </div>
  );
}
