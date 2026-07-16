export const CAMERA_WATCHDOG_MS = 2000;
export const CAMERA_MAX_AUTO_ATTEMPTS = 2;

export const isCameraFrameReady = (snapshot = {}) => (
  Number(snapshot.videoWidth || 0) > 0
  && Number(snapshot.videoHeight || 0) > 0
  && snapshot.trackReadyState === 'live'
  && snapshot.paused === false
);

export const getCameraRecoveryReason = (snapshot = {}) => {
  if (!snapshot.hasSrcObject) return 'missing_src_object';
  if (!snapshot.trackCount) return 'missing_video_track';
  if (snapshot.trackReadyState && snapshot.trackReadyState !== 'live') return `track_${snapshot.trackReadyState}`;
  if (snapshot.paused !== false) return 'video_not_playing';
  if (!snapshot.videoWidth || !snapshot.videoHeight) return 'empty_video_frame';
  return '';
};

export const shouldAutoRecoverCamera = (snapshot = {}, attempt = 1) => (
  !isCameraFrameReady(snapshot) && attempt < CAMERA_MAX_AUTO_ATTEMPTS
);

export const buildCameraAttemptDiag = ({ attempt = 1, startedAt = 0, reason = '', snapshot = {}, error = '' } = {}) => ({
  attempt,
  elapsedMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
  reason: reason || getCameraRecoveryReason(snapshot),
  errorCode: error ? String(error).slice(0, 120) : '',
  ...snapshot,
});
