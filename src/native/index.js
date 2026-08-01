import { installNativeDeepLinks } from './deepLinks.js';
import { installNativePush } from './push.js';

export async function installNativeRuntime() {
  await installNativeDeepLinks();
  await installNativePush();
}
