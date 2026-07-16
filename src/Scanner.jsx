import React, { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { motionTransition } from './motion.js';
import { sendDiagReport } from './diagnostics.js';
import { CAMERA_WATCHDOG_MS, buildCameraAttemptDiag, getCameraRecoveryReason, isCameraFrameReady, shouldAutoRecoverCamera } from './scannerReliability.js';

const T = { gold: '#C9A84C', goldL: '#E8C97A', textSec: 'rgba(240,240,240,0.45)' };
const CAMERA_BLACK_FRAME_ERROR = 'Не удалось запустить камеру. Попробуйте перезапустить её прямо здесь.';
const SCANNER_DIAG_KEY = 'apg_scanner_camera_diagnostics';

const safeDeviceId = (value = '') => {
  const text = String(value || '');
  if (!text) return '';
  return `${text.slice(0, 5)}…${text.slice(-4)}`;
};

const summarizeStream = (video) => {
  const stream = video?.srcObject;
  const tracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
  const track = tracks[0] || null;
  const settings = typeof track?.getSettings === 'function' ? track.getSettings() : {};
  return {
    hasSrcObject: Boolean(stream),
    trackCount: tracks.length,
    trackReadyState: track?.readyState || null,
    trackEnabled: track?.enabled ?? null,
    videoWidth: video?.videoWidth || 0,
    videoHeight: video?.videoHeight || 0,
    paused: video?.paused ?? null,
    cameraDeviceId: safeDeviceId(settings.deviceId),
    facingMode: settings.facingMode || null,
  };
};

const stopVideoTracks = (video) => {
  const stream = video?.srcObject;
  const tracks = typeof stream?.getTracks === 'function' ? stream.getTracks() : [];
  tracks.forEach(track => {
    try { track.stop(); } catch {}
  });
  if (video) {
    try { video.pause?.(); } catch {}
    try { video.srcObject = null; } catch {}
  }
  return tracks.length;
};

export default function Scanner({ isOpen, onClose, onConfirm, diagnosticUser = null }) {
  const videoRef       = useRef(null);
  const scannerRef     = useRef(null);
  const doneRef        = useRef(false);
  const onConfirmRef   = useRef(onConfirm);
  const diagnosticUserRef = useRef(diagnosticUser);
  const dragStartYRef   = useRef(0);
  const diagSeqRef      = useRef(0);
  const [restartNonce, setRestartNonce] = useState(0);
  const [err, setErr]           = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn]   = useState(false);
  const [dragY, setDragY]       = useState(0);

  useEffect(() => { onConfirmRef.current = onConfirm; }, [onConfirm]);
  useEffect(() => { diagnosticUserRef.current = diagnosticUser; }, [diagnosticUser]);

  const logCameraDiag = useCallback((stage, details = {}) => {
    const activeUser = diagnosticUserRef.current;
    const payload = {
      stage,
      seq: ++diagSeqRef.current,
      at: new Date().toISOString(),
      userContext: activeUser ? 'present' : 'guest',
      displayMode: window.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser',
      standalone: Boolean(window.navigator?.standalone),
      permission: details.permission || null,
      ...details,
    };
    try {
      const previous = JSON.parse(localStorage.getItem(SCANNER_DIAG_KEY) || '[]');
      localStorage.setItem(SCANNER_DIAG_KEY, JSON.stringify([...previous, payload].slice(-40)));
    } catch {}
    try { console.info('[APG Scanner]', payload); } catch {}
    if (['stream_timeout', 'play_error', 'start_error', 'track_stopped', 'closed'].includes(stage)) {
      sendDiagReport({
        checks: { scannerCamera: payload },
        errorText: `scanner_camera_${stage}`,
        manual: false,
      });
    }
  }, []);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      try { scannerRef.current.stop(); } catch {}
      try { scannerRef.current.destroy(); } catch {}
      scannerRef.current = null;
    }
    const stoppedTracks = stopVideoTracks(videoRef.current);
    if (stoppedTracks > 0) logCameraDiag('track_stopped', { stoppedTracks });
  }, [logCameraDiag]);

  useEffect(() => {
    if (!isOpen) {
      doneRef.current = false;
      setErr(null);
      setRecovering(false);
      setTorchOn(false);
      setHasTorch(false);
      return;
    }

    let active = true;
    let frameTimer = 0;
    let permission = 'unknown';
    let attempt = 0;
    let trackCleanup = () => {};
    const videoEvents = ['loadedmetadata', 'canplay', 'playing', 'pause', 'stalled', 'suspend', 'emptied'];
    const handleVideoEvent = (event) => {
      if (!active) return;
      logCameraDiag(`video_${event.type}`, summarizeStream(videoRef.current));
    };
    const clearFrameTimer = () => {
      if (frameTimer) {
        clearTimeout(frameTimer);
        frameTimer = 0;
      }
    };

    const startScannerAttempt = async (reason = 'initial') => {
      if (!active || !videoRef.current) return;
      attempt += 1;
      const currentAttempt = attempt;
      const startedAt = Date.now();
      clearFrameTimer();
      trackCleanup();
      trackCleanup = () => {};
      stopScanner();
      setHasTorch(false);
      setTorchOn(false);
      if (currentAttempt === 1) setErr(null);
      logCameraDiag('start_attempt', { attempt: currentAttempt, reason, permission, startedAt });

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

      try {
        await scanner.start();
        if (!active || currentAttempt !== attempt) return;
        const video = videoRef.current;
        const streamSnapshot = summarizeStream(video);
        logCameraDiag('stream_created', buildCameraAttemptDiag({ attempt: currentAttempt, startedAt, reason, snapshot: { permission, ...streamSnapshot } }));
        const tracks = typeof video?.srcObject?.getVideoTracks === 'function' ? video.srcObject.getVideoTracks() : [];
        const handleTrackEnded = () => {
          if (!active || currentAttempt !== attempt) return;
          const snapshot = summarizeStream(videoRef.current);
          const recoveryReason = getCameraRecoveryReason(snapshot) || 'track_ended';
          logCameraDiag('track_ended', buildCameraAttemptDiag({ attempt: currentAttempt, startedAt, reason: recoveryReason, snapshot: { permission, ...snapshot } }));
          if (shouldAutoRecoverCamera(snapshot, currentAttempt)) {
            setRecovering(true);
            startScannerAttempt(recoveryReason);
          } else {
            setRecovering(false);
            setErr(CAMERA_BLACK_FRAME_ERROR);
          }
        };
        tracks.forEach(track => {
          try { track.addEventListener?.('ended', handleTrackEnded, { once: true }); } catch {}
        });
        trackCleanup = () => tracks.forEach(track => {
          try { track.removeEventListener?.('ended', handleTrackEnded); } catch {}
        });
        try {
          await video?.play?.();
          logCameraDiag('video_play_success', buildCameraAttemptDiag({ attempt: currentAttempt, startedAt, reason, snapshot: { permission, ...summarizeStream(video) } }));
        } catch (error) {
          const snapshot = summarizeStream(video);
          logCameraDiag('play_error', buildCameraAttemptDiag({ attempt: currentAttempt, startedAt, reason: 'play_error', error: error?.name || error?.message || error, snapshot: { permission, ...snapshot } }));
          if (shouldAutoRecoverCamera(snapshot, currentAttempt)) {
            setRecovering(true);
            startScannerAttempt('play_error');
          } else {
            setRecovering(false);
            setErr(CAMERA_BLACK_FRAME_ERROR);
          }
          return;
        }
        frameTimer = window.setTimeout(() => {
          if (!active || currentAttempt !== attempt) return;
          const snapshot = summarizeStream(videoRef.current);
          const hasFrame = isCameraFrameReady(snapshot);
          const recoveryReason = getCameraRecoveryReason(snapshot);
          logCameraDiag(hasFrame ? 'frame_ready' : 'stream_timeout', buildCameraAttemptDiag({ attempt: currentAttempt, startedAt, reason: recoveryReason || reason, snapshot: { permission, ...snapshot } }));
          if (hasFrame) {
            setRecovering(false);
            scanner.hasFlash().then(has => { if (active && currentAttempt === attempt) setHasTorch(has); });
            return;
          }
          if (shouldAutoRecoverCamera(snapshot, currentAttempt)) {
            setRecovering(true);
            logCameraDiag('auto_recovery_start', buildCameraAttemptDiag({ attempt: currentAttempt, startedAt, reason: recoveryReason, snapshot: { permission, ...snapshot } }));
            startScannerAttempt(recoveryReason || 'empty_video_frame');
            return;
          }
          setRecovering(false);
          setErr(CAMERA_BLACK_FRAME_ERROR);
        }, CAMERA_WATCHDOG_MS);
      } catch (error) {
        const snapshot = summarizeStream(videoRef.current);
        logCameraDiag('start_error', buildCameraAttemptDiag({ attempt: currentAttempt, startedAt, reason: 'start_error', error: error?.name || error?.message || error, snapshot: { permission, ...snapshot } }));
        if (shouldAutoRecoverCamera(snapshot, currentAttempt)) {
          setRecovering(true);
          startScannerAttempt('start_error');
        } else {
          setRecovering(false);
          setErr('Нет доступа к камере или камера не отвечает.');
        }
      }
    };

    // Wait for video element to mount
    const timer = setTimeout(async () => {
      if (!videoRef.current || !active) return;
      try {
        const status = await navigator.permissions?.query?.({ name: 'camera' });
        permission = status?.state || 'unknown';
      } catch {}
      logCameraDiag('register_start', {
        permission,
        hasMediaDevices: Boolean(navigator.mediaDevices),
        hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      });
      videoEvents.forEach(name => videoRef.current?.addEventListener(name, handleVideoEvent));
      startScannerAttempt('initial');
    }, 50);

    return () => {
      active = false;
      clearTimeout(timer);
      clearFrameTimer();
      trackCleanup();
      videoEvents.forEach(name => videoRef.current?.removeEventListener(name, handleVideoEvent));
      stopScanner();
    };
  }, [isOpen, restartNonce, stopScanner, logCameraDiag]);

  const handleClose = useCallback(() => {
    stopScanner();
    setDragY(0);
    onClose?.();
  }, [stopScanner, onClose]);

  const toggleTorch = useCallback(() => {
    if (!scannerRef.current) return;
    const next = !torchOn;
    setTorchOn(next);
    scannerRef.current.toggleFlash();
  }, [torchOn]);

  const restartCamera = useCallback(() => {
    setErr(null);
    setRecovering(false);
    setHasTorch(false);
    setTorchOn(false);
    logCameraDiag('manual_restart_requested', summarizeStream(videoRef.current));
    setRestartNonce(value => value + 1);
  }, [logCameraDiag]);

  if (!isOpen) return null;

  return (
    <div
      onTouchStart={(e) => { dragStartYRef.current = e.touches[0].clientY; }}
      onTouchMove={(e) => {
        const dy = e.touches[0].clientY - dragStartYRef.current;
        if (dy > 0) setDragY(Math.min(dy, 190));
      }}
      onTouchEnd={() => {
        if (dragY > 96) {
          handleClose();
          return;
        }
        setDragY(0);
      }}
      onTouchCancel={() => setDragY(0)}
      style={{
      position: 'fixed', inset: 0,
      background: '#000',
      zIndex: 12000,
      display: 'flex', flexDirection: 'column',
      transform: `translate3d(0, ${dragY}px, 0)`,
      opacity: dragY ? Math.max(0.68, 1 - dragY / 420) : 1,
      transition: dragY ? 'none' : motionTransition(['transform', 'opacity'], 'base'),
      animation: 'scannerEnter var(--motion-panel, 280ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
      touchAction: 'pan-y',
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
        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', width: 46, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.32)', boxShadow: '0 0 20px rgba(201,168,76,0.18)' }} />
        {err ? (
          <div style={{
            background: 'rgba(230,70,70,0.15)',
            border: '1px solid rgba(230,70,70,0.35)',
            borderRadius: 16, padding: '16px 20px',
            color: '#fff', fontSize: 14, textAlign: 'center',
            maxWidth: 280, lineHeight: '20px',
            backdropFilter: 'blur(12px)',
          }}>
            <div>{err}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={restartCamera} style={{ border: 'none', borderRadius: 12, padding: '10px 14px', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#111', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                🔄 Перезапустить камеру
              </button>
              <button onClick={handleClose} style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Закрыть
              </button>
            </div>
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
              {recovering ? 'Восстанавливаем камеру…' : 'Наведите камеру на QR-код партнёра'}
            </div>
          </>
        )}
      </div>

      {/* Bottom padding */}
      <div style={{ height: 60 }} />
    </div>
  );
}
