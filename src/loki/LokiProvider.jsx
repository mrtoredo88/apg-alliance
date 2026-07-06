import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { logError } from '../errorLogger.js';
import { LOKI_EVENTS } from './lokiEvents.js';
import { getLokiPhrase } from './lokiPhrases.js';
import { subscribeLoki } from './lokiBus.js';
import { LOKI_ACTIONS, TAP_ACTIONS, getBehaviorForEvent, getNextMicroDelay, getRandomLokiAction, shouldUseNightAction } from './lokiBehavior.js';
import {
  DEFAULT_LOKI_SETTINGS,
  hasLokiDailyVisit,
  hasSeenLokiGreeting,
  loadLokiSettings,
  markLokiDailyVisit,
  markLokiGreetingSeen,
  normalizeLokiSettings,
  saveLokiSettings,
} from './lokiState.js';

const LokiContext = createContext(null);

function getUserId(user) {
  return user?.id ? String(user.id) : 'guest';
}

export function LokiProvider({ children, user, activePanel }) {
  const [settings, setSettings] = useState(() => loadLokiSettings());
  const [visible, setVisible] = useState(false);
  const [emotion, setEmotion] = useState('idle');
  const [message, setMessage] = useState('');
  const [anchor, setAnchor] = useState('home');
  const [action, setAction] = useState(LOKI_ACTIONS.IDLE);
  const [dismissed, setDismissed] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const hideTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const microTimerRef = useRef(null);
  const actionTimerRef = useRef(null);
  const presenceTimerRef = useRef(null);
  const settingsHydratedRef = useRef(false);
  const settingsDirtyRef = useRef(false);
  const userId = getUserId(user);
  const isHiddenOnPanel = settings.hiddenPanels.includes(activePanel);
  const canTalk = settings.enabled && settings.bubbleEnabled && !isHiddenOnPanel;

  const persistSettings = useCallback((next, options = {}) => {
    const normalized = normalizeLokiSettings(next);
    if (options.sync !== false) settingsDirtyRef.current = true;
    saveLokiSettings(normalized);
    setSettings(normalized);
  }, []);

  const showMessage = useCallback((eventType, payload = {}) => {
    const config = getBehaviorForEvent(eventType);
    setLastEvent({ eventType, payload, ts: Date.now() });
    setAnchor(config.anchor ?? 'home');
    setAction(payload.action ?? config.action ?? LOKI_ACTIONS.IDLE);
    setEmotion(config.emotion);
    setDismissed(false);
    setVisible(true);
    if (settings.enabled && settings.bubbleEnabled) {
      setMessage(getLokiPhrase(eventType, payload));
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      setAction(LOKI_ACTIONS.IDLE);
      setEmotion(eventType === LOKI_EVENTS.USER_IDLE ? 'sleep' : 'idle');
    }, Math.min(3600, Math.max(1600, config.duration - 2200)));
    hideTimerRef.current = setTimeout(() => {
      setMessage('');
      setEmotion(eventType === LOKI_EVENTS.USER_IDLE ? 'sleep' : 'idle');
    }, config.duration);
    presenceTimerRef.current = setTimeout(() => {
      setVisible(false);
      setAnchor('home');
      setAction(LOKI_ACTIONS.IDLE);
    }, config.duration + 1900);
  }, [settings.bubbleEnabled, settings.enabled]);

  useEffect(() => subscribeLoki(showMessage), [showMessage]);

  useEffect(() => {
    if (!user?.lokiSettings || settingsHydratedRef.current) return;
    settingsHydratedRef.current = true;
    persistSettings({ ...DEFAULT_LOKI_SETTINGS, ...loadLokiSettings(), ...user.lokiSettings }, { sync: false });
  }, [persistSettings, user?.lokiSettings]);

  useEffect(() => {
    if (!user?.id || user.isGuest) return;
    if (!settingsDirtyRef.current) return;
    setDoc(doc(db, 'users', String(user.id)), {
      lokiSettings: settings,
      lokiSettingsUpdatedAt: serverTimestamp(),
    }, { merge: true })
      .then(() => { settingsDirtyRef.current = false; })
      .catch(e => logError(e, 'LokiProvider.persistSettings'));
  }, [settings, user?.id, user?.isGuest]);

  useEffect(() => {
    if (!settings.enabled || !user) return;
    if (!hasSeenLokiGreeting(userId)) {
      const t = setTimeout(() => {
        showMessage(LOKI_EVENTS.USER_LOGIN, { userId });
        markLokiGreetingSeen(userId);
      }, 1100);
      return () => clearTimeout(t);
    }
  }, [settings.enabled, showMessage, user, userId]);

  useEffect(() => {
    if (!settings.enabled || !user) return;
    const dayKey = new Date().toLocaleDateString('sv');
    if (hasLokiDailyVisit(userId, dayKey)) return;
    if (!hasSeenLokiGreeting(userId)) return;
    markLokiDailyVisit(userId, dayKey);
    const t = setTimeout(() => showMessage(LOKI_EVENTS.RETURN_VISIT, { dayKey }), 4200);
    return () => clearTimeout(t);
  }, [settings.enabled, showMessage, user, userId]);

  useEffect(() => {
    if (!settings.enabled) return;
    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') showMessage(LOKI_EVENTS.USER_IDLE);
      }, 52000);
    };
    resetIdle();
    window.addEventListener('pointerdown', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle);
    window.addEventListener('scroll', resetIdle, { passive: true });
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      window.removeEventListener('scroll', resetIdle);
    };
  }, [settings.enabled, showMessage]);

  useEffect(() => {
    if (!settings.enabled) return;
    const scheduleMicroAction = () => {
      if (microTimerRef.current) clearTimeout(microTimerRef.current);
      microTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible' && visible && !message) {
          const nextAction = shouldUseNightAction() ? LOKI_ACTIONS.YAWN : getRandomLokiAction();
          setAction(nextAction);
          setEmotion(nextAction === LOKI_ACTIONS.YAWN ? 'sleep' : 'idle');
          if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
          actionTimerRef.current = setTimeout(() => {
            setAction(LOKI_ACTIONS.IDLE);
            setEmotion('idle');
            scheduleMicroAction();
          }, 2400);
        } else {
          scheduleMicroAction();
        }
      }, getNextMicroDelay());
    };
    scheduleMicroAction();
    return () => {
      if (microTimerRef.current) clearTimeout(microTimerRef.current);
    };
  }, [message, settings.enabled, visible]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (microTimerRef.current) clearTimeout(microTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
  }, []);

  const handleCharacterTap = useCallback(() => {
    const tapAction = getRandomLokiAction(TAP_ACTIONS);
    setAnchor('home');
    setAction(tapAction);
    showMessage(LOKI_EVENTS.CHARACTER_TAP, { source: 'tap', action: tapAction });
  }, [showMessage]);

  const value = useMemo(() => ({
    action,
    activePanel,
    anchor,
    canTalk,
    dismissed,
    emotion,
    isHiddenOnPanel,
    lastEvent,
    message,
    settings,
    handleCharacterTap,
    showMessage,
    visible,
    hide: () => { setDismissed(true); setVisible(false); },
    show: () => { setDismissed(false); setVisible(true); },
    hideCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: [...new Set([...settings.hiddenPanels, activePanel])] }),
    showCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: settings.hiddenPanels.filter(panel => panel !== activePanel) }),
    setHintsEnabled: (enabled) => persistSettings({ ...settings, enabled }),
    setBubbleEnabled: (bubbleEnabled) => persistSettings({ ...settings, bubbleEnabled }),
  }), [action, activePanel, anchor, canTalk, dismissed, emotion, handleCharacterTap, isHiddenOnPanel, lastEvent, message, persistSettings, settings, showMessage, visible]);

  return <LokiContext.Provider value={value}>{children}</LokiContext.Provider>;
}

export function useLoki() {
  const value = useContext(LokiContext);
  if (!value) throw new Error('useLoki must be used inside LokiProvider');
  return value;
}
