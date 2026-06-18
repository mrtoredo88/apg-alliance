import React, { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import qrWorkerSrc from 'qr-scanner/qr-scanner-worker.min.js?url';

QrScanner.WORKER_PATH = qrWorkerSrc;

const T = { gold: '#C9A84C', goldL: '#E8C97A', textSec: 'rgba(240,240,240,0.45)' };

export default function Scanner({ isOpen, onClose, onConfirm }) {
  const videoRef       = useRef(null);
  const scannerRef     = useRef(null);
  const doneRef        = useRef(false);
  const onConfirmRef   = useRef(onConfirm);
  const [err, setErr]           = useState(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn]   = useState(false);

  useEffect(() => { onConfirmRef.current = onConfirm; }, [onConfirm]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      doneRef.current = false;
      setErr(null);
      setTorchOn(false);
      return;
    }

    let active = true;

    // Wait for video element to mount
    const timer = setTimeout(() => {
      if (!videoRef.current || !active) return;

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (doneRef.current) return;
          doneRef.current = true;
          stopScanner();
          onConfirmRef.current?.(result.data);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: false,
          highlightCodeOutline: false,
          preferredCamera: 'environment',
        },
      );

      scannerRef.current = scanner;

      scanner.start()
        .then(() => {
          scanner.hasFlash().then(has => { if (active) setHasTorch(has); });
        })
        .catch(() => {
          if (active) setErr('Нет доступа к камере. Разрешите его в настройках браузера.');
        });
    }, 50);

    return () => {
      active = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, stopScanner]);

  const handleClose = useCallback(() => {
    stopScanner();
    onClose?.();
  }, [stopScanner, onClose]);

  const toggleTorch = useCallback(() => {
    if (!scannerRef.current) return;
    const next = !torchOn;
    setTorchOn(next);
    scannerRef.current.toggleFlash();
  }, [torchOn]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Camera feed */}
      <video
        ref={videoRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        muted playsInline
      />

      {/* Dark vignette overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 260px 260px at 50% 44%, transparent 100%, rgba(0,0,0,0.72) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Top bar */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 20px 0',
      }}>
        <button onClick={handleClose} style={{
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50%', width: 40, height: 40,
          color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>✕</button>

        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Сканер QR</div>

        {hasTorch ? (
          <button onClick={toggleTorch} style={{
            background: torchOn ? 'rgba(201,168,76,0.25)' : 'rgba(0,0,0,0.45)',
            border: `1px solid ${torchOn ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '50%', width: 40, height: 40,
            color: torchOn ? T.gold : '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>🔦</button>
        ) : <div style={{ width: 40 }} />}
      </div>

      {/* Scanning frame */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 24,
      }}>
        {err ? (
          <div style={{
            background: 'rgba(230,70,70,0.15)',
            border: '1px solid rgba(230,70,70,0.35)',
            borderRadius: 16, padding: '16px 20px',
            color: '#fff', fontSize: 14, textAlign: 'center',
            maxWidth: 280, lineHeight: '20px',
            backdropFilter: 'blur(12px)',
          }}>
            {err}
          </div>
        ) : (
          <>
            {/* Corner frame */}
            <div style={{ position: 'relative', width: 240, height: 240 }}>
              {[
                { top: 0, left: 0, borderTop: true, borderLeft: true },
                { top: 0, right: 0, borderTop: true, borderRight: true },
                { bottom: 0, left: 0, borderBottom: true, borderLeft: true },
                { bottom: 0, right: 0, borderBottom: true, borderRight: true },
              ].map((corner, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 28, height: 28,
                  ...corner,
                  borderTopWidth:    corner.borderTop    ? 3 : 0,
                  borderLeftWidth:   corner.borderLeft   ? 3 : 0,
                  borderBottomWidth: corner.borderBottom ? 3 : 0,
                  borderRightWidth:  corner.borderRight  ? 3 : 0,
                  borderStyle: 'solid',
                  borderColor: T.gold,
                  borderRadius: corner.borderTop && corner.borderLeft ? '4px 0 0 0'
                    : corner.borderTop && corner.borderRight ? '0 4px 0 0'
                    : corner.borderBottom && corner.borderLeft ? '0 0 0 4px'
                    : '0 0 4px 0',
                }} />
              ))}
              {/* Scan line animation */}
              <div style={{
                position: 'absolute', left: 4, right: 4, height: 2,
                background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)`,
                animation: 'scanLine 2s ease-in-out infinite',
                boxShadow: `0 0 8px ${T.gold}`,
              }} />
            </div>

            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', lineHeight: '20px' }}>
              Наведите камеру на QR-код партнёра
            </div>
          </>
        )}
      </div>

      {/* Bottom padding */}
      <div style={{ height: 60 }} />
    </div>
  );
}
