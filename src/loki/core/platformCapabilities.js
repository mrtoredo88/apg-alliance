import { LOKI_APP_ACTIONS, createLokiAction } from '../lokiActionTypes.js';

export const LOKI_PLATFORMS = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  TABLET: 'tablet',
  EMBEDDED: 'embedded',
};

export const LOKI_ALL_PLATFORMS = Object.values(LOKI_PLATFORMS);

function clean(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeLokiPlatform(input = {}) {
  const outer = input?.appState || input?.context?.appState || input?.contextEngine?.appState || input || {};
  const source = outer?.__lokiContext ? outer.appState || outer : outer;
  const explicit = clean(
    source.devicePlatform
      || source.platformDevice
      || source.platformMode
      || source.device
      || input?.devicePlatform
      || input?.platformDevice
      || input?.platform
      || source.platform
      || source.source
  );
  if (explicit.includes('desktop') || explicit.includes('workspace')) return LOKI_PLATFORMS.DESKTOP;
  if (explicit.includes('tablet') || explicit.includes('ipad')) return LOKI_PLATFORMS.TABLET;
  if (explicit.includes('embedded') || explicit.includes('vk-miniapp') || explicit.includes('webview') || explicit.includes('telegram')) return LOKI_PLATFORMS.EMBEDDED;
  if (explicit.includes('mobile') || explicit.includes('phone') || explicit.includes('ios') || explicit.includes('android')) return LOKI_PLATFORMS.MOBILE;
  return LOKI_PLATFORMS.DESKTOP;
}

export function isMobileLikeLokiPlatform(platform = '') {
  return [LOKI_PLATFORMS.MOBILE, LOKI_PLATFORMS.TABLET, LOKI_PLATFORMS.EMBEDDED].includes(normalizeLokiPlatform({ platform }));
}

export function isCapabilityAvailableForPlatform(capability = {}, platformInput = {}) {
  const supported = Array.isArray(capability.supportedPlatforms) && capability.supportedPlatforms.length
    ? capability.supportedPlatforms
    : LOKI_ALL_PLATFORMS;
  return supported.includes(normalizeLokiPlatform(platformInput));
}

export function resolveLokiActionForPlatform(actionRequest, platformInput = {}) {
  if (!actionRequest?.type) return actionRequest;
  const platform = normalizeLokiPlatform(platformInput);
  const mobileLike = isMobileLikeLokiPlatform(platform);
  if (!mobileLike) return actionRequest;
  if (actionRequest.type === LOKI_APP_ACTIONS.OPEN_PARTNERS) {
    return createLokiAction(LOKI_APP_ACTIONS.OPEN_OFFERS, {
      ...(actionRequest.payload || {}),
      originalAction: LOKI_APP_ACTIONS.OPEN_PARTNERS,
      platformFallback: 'mobile-offers',
    });
  }
  return actionRequest;
}

export function isLokiActionAvailableForPlatform(actionRequest, platformInput = {}) {
  return resolveLokiActionForPlatform(actionRequest, platformInput)?.type === actionRequest?.type;
}
