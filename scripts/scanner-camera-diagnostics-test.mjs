import fs from 'node:fs';
import path from 'node:path';

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
  'loadedmetadata',
  'canplay',
  'playing',
  'track_stopped',
  'videoWidth',
  'videoHeight',
  'trackReadyState',
  'cameraDeviceId',
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

if (!scannerSource.includes('snapshot.videoWidth > 0 && snapshot.videoHeight > 0')) {
  throw new Error('Scanner must detect a black camera surface through zero video dimensions.');
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

console.log('scanner-camera-diagnostics-test: ok');
