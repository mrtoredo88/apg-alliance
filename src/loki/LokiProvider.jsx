import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { logError } from '../errorLogger.js';
import { LOKI_EVENTS } from './lokiEvents.js';
import { getLokiPhrase } from './lokiPhrases.js';
import { subscribeLoki } from './lokiBus.js';
import { LOKI_ACTIONS, TAP_ACTIONS, getBehaviorForEvent, getNextMicroDelay, getRandomLokiAction, shouldUseNightAction } from './lokiBehavior.js';
import { DEFAULT_LOKI_MEMORY, loadLokiMemory, saveLokiMemory } from './lokiMemory.js';
import { getLokiSuggestion } from './lokiSuggestions.js';
import { LOKI_MESSAGE_PRIORITY, normalizeLokiActionRequest } from './lokiActionTypes.js';
import { evaluateLokiObserver } from './LokiObserver.js';
import { addLokiHistoryItem, loadLokiHistory, markLokiHistoryItem, saveLokiHistory } from './lokiHistory.js';
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

export function LokiProvider({ children, user, activePanel, appActions, appState }) {
  const [settings, setSettings] = useState(() => loadLokiSettings());
  const [memory, setMemory] = useState(() => loadLokiMemory());
  const [history, setHistory] = useState(() => loadLokiHistory());
  const [visible, setVisible] = useState(false);
  const [emotion, setEmotion] = useState('idle');
  const [message, setMessage] = useState('');
  const [card, setCard] = useState(null);
  const [anchor, setAnchor] = useState('home');
  const [action, setAction] = useState(LOKI_ACTIONS.IDLE);
  const [dismissed, setDismissed] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const queueRef = useRef([]);
  const activeHistoryIdRef = useRef(null);
  const currentPriorityRef = useRef(LOKI_MESSAGE_PRIORITY.LOW);
  const lastUserActionAtRef = useRef(Date.now());
  const lastPanelChangeAtRef = useRef(Date.now());
  const observerTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const microTimerRef = useRef(null);
  const actionTimerRef = useRef(null);
  const presenceTimerRef = useRef(null);
  const farewellTimerRef = useRef(null);
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

  const updateMemory = useCallback((patch) => {
    setMemory(prev => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, []);

  const updateHistory = useCallback((updater) => {
    setHistory(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLokiHistory(next);
      return next;
    });
  }, []);

  const displayMessage = useCallback((eventType, payload = {}) => {
    const config = getBehaviorForEvent(eventType);
    const priority = payload.priority ?? config.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL;
    currentPriorityRef.current = priority;
    setLastEvent({ eventType, payload, ts: Date.now() });
    setAnchor(config.anchor ?? 'home');
    setAction(payload.action ?? config.action ?? LOKI_ACTIONS.IDLE);
    setEmotion(config.emotion);
    setDismissed(false);
    setVisible(true);
    const nextCard = payload.card ?? getLokiSuggestion({ eventType, activePanel, payload });
    setCard(nextCard);
    activeHistoryIdRef.current = null;
    if (settings.enabled && settings.bubbleEnabled) {
      const nextMessage = getLokiPhrase(eventType, payload);
      setMessage(nextMessage);
      updateMemory({ lastMessage: { eventType, text: nextMessage, payload }, lastPanel: activePanel, inDialog: true });
      updateHistory(prev => {
        const item = {
          kind: payload.kind ?? 'message',
          adviceId: payload.adviceId ?? null,
          eventType,
          text: nextMessage,
          card: nextCard,
          priority,
          panel: activePanel,
        };
        const next = addLokiHistoryItem(prev, item);
        activeHistoryIdRef.current = next[0]?.id ?? null;
        return next;
      });
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      setAction(LOKI_ACTIONS.IDLE);
      setEmotion(eventType === LOKI_EVENTS.USER_IDLE ? 'sleep' : 'idle');
    }, Math.min(3600, Math.max(1600, config.duration - 2200)));
    hideTimerRef.current = setTimeout(() => {
      setMessage('');
      setCard(null);
      setEmotion(eventType === LOKI_EVENTS.USER_IDLE ? 'sleep' : 'idle');
    }, config.duration);
    if (eventType === LOKI_EVENTS.PROACTIVE_SUGGESTION) {
      farewellTimerRef.current = setTimeout(() => {
        setAction(LOKI_ACTIONS.WAVE);
        setEmotion('happy');
      }, config.duration + 520);
    }
    presenceTimerRef.current = setTimeout(() => {
      setVisible(false);
      setAnchor('home');
      setAction(LOKI_ACTIONS.IDLE);
      currentPriorityRef.current = LOKI_MESSAGE_PRIORITY.LOW;
      updateMemory({ inDialog: false, lastPanel: activePanel });
      const next = queueRef.current.shift();
      if (next) setTimeout(() => displayMessage(next.eventType, next.payload), 420);
    }, config.duration + 1900);
  }, [activePanel, settings.bubbleEnabled, settings.enabled, updateHistory, updateMemory]);

  const showMessage = useCallback((eventType, payload = {}) => {
    if (!settings.enabled) return;
    const config = getBehaviorForEvent(eventType);
    const priority = payload.priority ?? config.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL;
    const item = { eventType, payload: { ...payload, priority } };
    const hasActiveMessage = visible && (message || card);
    if (hasActiveMessage && priority <= currentPriorityRef.current) {
      queueRef.current = [...queueRef.current, item]
        .sort((a, b) => (b.payload.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL) - (a.payload.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL))
        .slice(0, 8);
      return;
    }
    displayMessage(eventType, item.payload);
  }, [card, displayMessage, message, visible]);

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
    const markUserAction = () => { lastUserActionAtRef.current = Date.now(); };
    window.addEventListener('pointerdown', markUserAction, { passive: true });
    window.addEventListener('keydown', markUserAction);
    window.addEventListener('scroll', markUserAction, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', markUserAction);
      window.removeEventListener('keydown', markUserAction);
      window.removeEventListener('scroll', markUserAction);
    };
  }, []);

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
    if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
  }, []);

  useEffect(() => {
    lastPanelChangeAtRef.current = Date.now();
    setMemory(prev => {
      const panelVisits = { ...(prev.panelVisits ?? {}), [activePanel]: ((prev.panelVisits ?? {})[activePanel] ?? 0) + 1 };
      const next = { ...prev, lastPanel: activePanel, panelVisits, updatedAt: new Date().toISOString() };
      saveLokiMemory(next);
      return next;
    });
  }, [activePanel]);

  useEffect(() => {
    if (!settings.enabled || !user || !appState) return;
    if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
    observerTimerRef.current = setTimeout(() => {
      const recommendation = evaluateLokiObserver({
        appState: { ...appState, activePanel },
        memory,
        history,
        lastUserActionAt: lastUserActionAtRef.current,
        lastPanelChangeAt: lastPanelChangeAtRef.current,
      });
      if (recommendation) showMessage(recommendation.eventType, recommendation.payload);
    }, 9000);
    return () => {
      if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
    };
  }, [activePanel, appState, history, memory, settings.enabled, showMessage, user]);

  const handleCharacterTap = useCallback(() => {
    const tapAction = getRandomLokiAction(TAP_ACTIONS);
    setAnchor('home');
    setAction(tapAction);
    showMessage(LOKI_EVENTS.CHARACTER_TAP, { source: 'tap', action: tapAction, priority: LOKI_MESSAGE_PRIORITY.NORMAL });
  }, [showMessage]);

  const executeAction = useCallback(async (request) => {
    const normalized = normalizeLokiActionRequest(request);
    if (!normalized?.type) return false;
    const handler = appActions?.[normalized.type];
    if (typeof handler !== 'function') {
      showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_action_missing', actionType: normalized.type, priority: LOKI_MESSAGE_PRIORITY.HIGH });
      return false;
    }
    updateMemory({ lastAction: { ...normalized, ts: new Date().toISOString() }, inDialog: false });
    if (activeHistoryIdRef.current) {
      const id = activeHistoryIdRef.current;
      updateHistory(prev => markLokiHistoryItem(prev, id, 'opened'));
    }
    try {
      await handler(normalized.payload ?? {});
      setCard(null);
      setMessage('');
      setVisible(false);
      return true;
    } catch (e) {
      logError(e, 'LokiProvider.executeAction');
      showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_action_failed', actionType: normalized.type, priority: LOKI_MESSAGE_PRIORITY.HIGH });
      return false;
    }
  }, [appActions, showMessage, updateMemory]);

  const value = useMemo(() => ({
    action,
    activePanel,
    anchor,
    canTalk,
    card,
    dismissed,
    emotion,
    executeAction,
    isHiddenOnPanel,
    lastEvent,
    history,
    memory: memory ?? DEFAULT_LOKI_MEMORY,
    message,
    settings,
    handleCharacterTap,
    showMessage,
    visible,
    hide: () => {
      if (activeHistoryIdRef.current) {
        const id = activeHistoryIdRef.current;
        updateHistory(prev => markLokiHistoryItem(prev, id, 'ignored'));
      }
      setDismissed(true); setVisible(false);
    },
    show: () => { setDismissed(false); setVisible(true); },
    hideCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: [...new Set([...settings.hiddenPanels, activePanel])] }),
    showCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: settings.hiddenPanels.filter(panel => panel !== activePanel) }),
    setHintsEnabled: (enabled) => persistSettings({ ...settings, enabled }),
    setBubbleEnabled: (bubbleEnabled) => persistSettings({ ...settings, bubbleEnabled }),
  }), [action, activePanel, anchor, canTalk, card, dismissed, emotion, executeAction, handleCharacterTap, history, isHiddenOnPanel, lastEvent, memory, message, persistSettings, settings, showMessage, updateHistory, visible]);

  return <LokiContext.Provider value={value}>{children}</LokiContext.Provider>;
}

export function useLoki() {
  const value = useContext(LokiContext);
  if (!value) throw new Error('useLoki must be used inside LokiProvider');
  return value;
}
