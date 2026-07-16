import fs from 'node:fs';
import path from 'node:path';
import {
  CAMERA_MAX_AUTO_ATTEMPTS,
  CAMERA_WATCHDOG_MS,
  getCameraRecoveryReason,
  isCameraFrameReady,
  shouldAutoRecoverCamera,
} from '../src/scannerReliability.js';

const root = process.cwd();
const scannerSource = fs.readFileSync(path.join(root, 'src/Scanner.jsx'), 'utf8');
const userAppSource = fs.readFileSync(path.join(root, 'src/UserApp.jsx'), 'utf8');

[
  'CAMERA_BLACK_FRAME_ERROR',
  'summarizeStream',
  'stopVideoTracks',
  'video_play_success',
  'play_error',
  'stream_timeout',
  'frame_ready',
  'start_attempt',
  'auto_recovery_start',
  'manual_restart_requested',
  'track_ended',
  'restartCamera',
  'setRestartNonce',
  'loadedmetadata',
  'canplay',
  'playing',
  'track_stopped',
  'videoWidth',
  'videoHeight',
  'trackReadyState',
  'cameraDeviceId',
  'CAMERA_WATCHDOG_MS',
].forEach(token => {
  if (!scannerSource.includes(token)) {
    throw new Error(`Scanner camera diagnostics must include ${token}.`);
  }
});

if (!scannerSource.includes('navigator.permissions?.query?.({ name: \'camera\' })')) {
  throw new Error('Scanner must record camera permission state when the API is available.');
}

if (!scannerSource.includes('await video?.play?.()')) {
  throw new Error('Scanner must explicitly verify video.play() after QrScanner.start().');
}

if (!scannerSource.includes('isCameraFrameReady(snapshot)')) {
  throw new Error('Scanner must detect a black camera surface through the reliability helper.');
}

if (!scannerSource.includes('shouldAutoRecoverCamera(snapshot, currentAttempt)')) {
  throw new Error('Scanner must attempt automatic recovery before showing an error.');
}

if (!scannerSource.includes('stopScanner();') || !scannerSource.includes('track.stop()')) {
  throw new Error('Scanner must stop previous tracks before restarting the camera.');
}

if (!scannerSource.includes('🔄 Перезапустить камеру') || !scannerSource.includes('Закрыть')) {
  throw new Error('Scanner must offer manual camera restart and close actions after failed recovery.');
}

if (!scannerSource.includes('localStorage.setItem(SCANNER_DIAG_KEY')) {
  throw new Error('Scanner must keep recent production-safe local diagnostics for targeted support.');
}

if (!scannerSource.includes('sendDiagReport({')) {
  throw new Error('Scanner must send production-safe diagnostics for failed camera lifecycle stages.');
}

if (!userAppSource.includes('diagnosticUser={{') || !userAppSource.includes('email: user?.email')) {
  throw new Error('UserApp must pass safe user context to Scanner diagnostics.');
}

if (CAMERA_WATCHDOG_MS !== 2000) {
  throw new Error('Scanner watchdog must verify the camera frame after 2 seconds.');
}

if (CAMERA_MAX_AUTO_ATTEMPTS !== 2) {
  throw new Error('Scanner must make one automatic recovery attempt after the initial launch.');
}

const liveFrame = { hasSrcObject: true, trackCount: 1, trackReadyState: 'live', paused: false, videoWidth: 1280, videoHeight: 720 };
const emptyFrame = { hasSrcObject: true, trackCount: 1, trackReadyState: 'live', paused: false, videoWidth: 0, videoHeight: 0 };
const endedTrack = { hasSrcObject: true, trackCount: 1, trackReadyState: 'ended', paused: false, videoWidth: 0, videoHeight: 0 };
const pausedFrame = { hasSrcObject: true, trackCount: 1, trackReadyState: 'live', paused: true, videoWidth: 1280, videoHeight: 720 };

if (!isCameraFrameReady(liveFrame)) throw new Error('Live camera frame must be treated as ready.');
if (isCameraFrameReady(emptyFrame)) throw new Error('Zero-dimension stream must not be treated as ready.');
if (getCameraRecoveryReason(emptyFrame) !== 'empty_video_frame') throw new Error('Zero-dimension stream must request empty-frame recovery.');
if (getCameraRecoveryReason(endedTrack) !== 'track_ended') throw new Error('Ended video track must be detected.');
if (getCameraRecoveryReason(pausedFrame) !== 'video_not_playing') throw new Error('Paused video must be detected.');
if (!shouldAutoRecoverCamera(emptyFrame, 1)) throw new Error('First empty stream must trigger automatic recovery.');
if (shouldAutoRecoverCamera(emptyFrame, 2)) throw new Error('Second failed attempt must show manual recovery instead of looping.');

console.log('scanner-camera-diagnostics-test: ok');
