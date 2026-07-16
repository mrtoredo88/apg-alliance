import { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { API_BASE_URL } from './constants.js';

const ACCEPT = 'image/jpeg,image/png,image/webp';

async function compressAndUpload(file, folder, onProgress) {
  onProgress(10);
  let compressed;
  try {
    compressed = await imageCompression(file, {
      maxWidthOrHeight: 1920,
      initialQuality: 0.85,
      fileType: 'image/webp',
      useWebWorker: true,
      onProgress: p => onProgress(10 + Math.round(p * 0.4)),
    });
  } catch {
    compressed = file;
  }

  onProgress(55);
  const buffer = await compressed.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const base64 = btoa(binary);
  const baseName = file.name.replace(/\.[^.]+$/, '');

  onProgress(60);
  const res = await fetch(`${API_BASE_URL}/api/upload-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, filename: baseName, contentType: compressed.type, data: base64 }),
  });
  if (!res.ok) throw new Error('upload failed');
  const { url } = await res.json();

  onProgress(100);
  return url;
}

// Single photo upload — shape: 'round' | 'cover'
export function PhotoUpload({ value, onChange, folder, label = 'Загрузить фото', shape = 'round', theme }) {
  const inputRef = useRef();
  const [progress, setProgress] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  const T = theme ?? { chipBg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', textSec: 'rgba(255,255,255,0.5)', gold: '#C9A84C' };

  async function upload(file) {
    if (!file) return;
    setError(null);
    try {
      const url = await compressAndUpload(file, folder, setProgress);
      onChange(url);
    } catch (e) {
      setError('Ошибка загрузки. Проверьте настройки бакета.');
    } finally { setProgress(null); }
  }

  const preview = shape === 'round'
    ? <div style={{ position: 'relative', display: 'inline-block' }}>
        <img src={value} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${T.gold}`, display: 'block' }} />
        <button onClick={() => onChange('')} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#E64646', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        <button onClick={() => inputRef.current.click()} style={{ marginTop: 8, fontSize: 12, background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSec, padding: '4px 10px', cursor: 'pointer', display: 'block' }}>Заменить</button>
      </div>
    : <div style={{ position: 'relative' }}>
        <img src={value} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 10, display: 'block', border: `1px solid ${T.gold}` }} />
        <button onClick={() => onChange('')} style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        <button onClick={() => inputRef.current.click()} style={{ marginTop: 6, fontSize: 12, background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSec, padding: '4px 10px', cursor: 'pointer' }}>Заменить</button>
      </div>;

  return (
    <div style={{ marginBottom: 12 }}>
      {value ? preview : (
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}
          style={{ border: `2px dashed ${dragging ? T.gold : T.border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: dragging ? `${T.gold}11` : T.chipBg, transition: 'all 0.2s' }}
        >
          <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
          <div style={{ fontSize: 13, color: T.textSec }}>{label}</div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>JPG, PNG, WebP</div>
        </div>
      )}
      {progress !== null && <ProgressBar progress={progress} textSec={T.textSec} gold={T.gold} border={T.border} />}
      {error && <div style={{ fontSize: 12, color: '#E64646', marginTop: 6 }}>{error}</div>}
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={e => upload(e.target.files[0])} style={{ display: 'none' }} />
    </div>
  );
}

// Gallery upload — value: string[], onChange: (urls: string[]) => void, max default 6
export function GalleryUpload({ value = [], onChange, folder, max = 6, theme }) {
  const inputRef = useRef();
  const [progresses, setProgresses] = useState({});
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const accRef = useRef(null);

  const T = theme ?? { chipBg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', textSec: 'rgba(255,255,255,0.5)', gold: '#C9A84C' };

  async function uploadMany(files) {
    setError(null);
    const list = Array.from(files);
    accRef.current = [...value];
    const slots = max - accRef.current.length;
    if (slots <= 0) return;
    await Promise.all(list.slice(0, slots).map(async file => {
      const id = Math.random().toString(36).slice(2);
      try {
        const url = await compressAndUpload(file, folder, p => setProgresses(prev => ({ ...prev, [id]: p })));
        accRef.current = [...accRef.current, url];
        onChange([...accRef.current]);
      } catch (e) {
        setError('Ошибка загрузки фото');
      } finally {
        setProgresses(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    }));
    accRef.current = null;
  }

  function remove(i) { onChange(value.filter((_, idx) => idx !== i)); }

  const uploading = Object.keys(progresses).length;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {value.map((url, i) => (
          <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}` }}>
            <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <button onClick={() => remove(i)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ))}
        {uploading > 0 && Array.from({ length: uploading }).map((_, i) => (
          <div key={`up-${i}`} style={{ aspectRatio: '1', borderRadius: 10, background: T.chipBg, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, color: T.textSec }}>...</div>
          </div>
        ))}
        {value.length + uploading < max && (
          <div
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); uploadMany(e.dataTransfer.files); }}
            style={{ aspectRatio: '1', borderRadius: 10, border: `2px dashed ${dragging ? T.gold : T.border}`, background: dragging ? `${T.gold}11` : T.chipBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}
          >
            <div style={{ fontSize: 22 }}>＋</div>
            <div style={{ fontSize: 10, color: T.textSec }}>{value.length}/{max}</div>
          </div>
        )}
      </div>
      {Object.values(progresses).map((p, i) => (
        <ProgressBar key={i} progress={p} textSec={T.textSec} gold={T.gold} border={T.border} />
      ))}
      {error && <div style={{ fontSize: 12, color: '#E64646', marginTop: 6 }}>{error}</div>}
      <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={e => uploadMany(e.target.files)} style={{ display: 'none' }} />
    </div>
  );
}

function ProgressBar({ progress, textSec, gold, border }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 4, borderRadius: 2, background: border, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: gold, width: `${progress}%`, transition: 'width 0.2s' }} />
      </div>
      <div style={{ fontSize: 11, color: textSec, marginTop: 4 }}>
        {progress < 45 ? 'Сжатие...' : `Загрузка ${progress}%`}
      </div>
    </div>
  );
}

export default PhotoUpload;
