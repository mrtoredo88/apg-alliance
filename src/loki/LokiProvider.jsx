import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { logError } from '../errorLogger.js';
import { userAction } from '../userApi.js';
import { LOKI_EVENTS } from './lokiEvents.js';
import { getLokiPhrase } from './lokiPhrases.js';
import { subscribeLoki } from './lokiBus.js';
import { LOKI_ACTIONS, TAP_ACTIONS, getBehaviorForEvent, getNextMicroDelay, getRandomLokiAction, shouldUseNightAction } from './lokiBehavior.js';
import { DEFAULT_LOKI_MEMORY, loadLokiMemory, saveLokiMemory } from './lokiMemory.js';
import { getLokiSuggestion } from './lokiSuggestions.js';
import { LOKI_MESSAGE_PRIORITY, normalizeLokiActionRequest } from './lokiActionTypes.js';
import { evaluateLokiObserver } from './LokiObserver.js';
import { addLokiHistoryItem, loadLokiHistory, markLokiHistoryItem, saveLokiHistory } from './lokiHistory.js';
import { askLokiBrain } from './LokiBrain.js';
import {
  evolveLokiEmotion,
  getEmotionalMicroAction,
  getLokiEmotionalPayload,
  getLokiEmotionalPresentation,
  normalizeLokiEmotionState,
  shouldLokiStayQuiet,
} from './LokiEmotionEngine.js';
import { clearLokiUserMemory, learnFromLokiQuery, loadLokiUserMemory } from './core/lokiUserMemory.js';
import { learnFromPanelVisit, learnFromRecommendationResult } from './LokiLearning.js';
import { buildInterestProfile, buildRecommendationFeed, buildScenarioCollections } from './LokiRecommendationCenter.js';
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

function isLokiDebugEnabled() {
  try {
    return localStorage.getItem('apg_loki_debug') === '1';
  } catch {
    return false;
  }
}

export function LokiProvider({ children, user, activePanel, appActions, appState }) {
  const [settings, setSettings] = useState(() => loadLokiSettings());
  const [memory, setMemory] = useState(() => loadLokiMemory());
  const [emotionalState, setEmotionalState] = useState(() => normalizeLokiEmotionState(loadLokiMemory().emotionalState));
  const [userMemory, setUserMemory] = useState(() => loadLokiUserMemory());
  const [history, setHistory] = useState(() => loadLokiHistory());
  const [visible, setVisible] = useState(false);
  const [emotion, setEmotion] = useState('idle');
  const [message, setMessage] = useState('');
  const [card, setCard] = useState(null);
  const [brainThinking, setBrainThinking] = useState(false);
  const [experienceOpen, setExperienceOpen] = useState(false);
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
  const homePresenceTimerRef = useRef(null);
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

  const resetUserMemory = useCallback(() => {
    clearLokiUserMemory();
    const fresh = loadLokiUserMemory();
    setUserMemory(fresh);
  }, []);

  const displayMessage = useCallback((eventType, payload = {}) => {
    const config = getBehaviorForEvent(eventType);
    const priority = payload.priority ?? config.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL;
    const nextEmotionalState = evolveLokiEmotion({ previous: emotionalState, eventType });
    const emotionalPresentation = getLokiEmotionalPresentation({ config, eventType, payload, emotionalState: nextEmotionalState });
    currentPriorityRef.current = priority;
    setLastEvent({ eventType, payload, ts: Date.now() });
    setAnchor(config.anchor ?? 'home');
    setAction(emotionalPresentation.action);
    setEmotion(emotionalPresentation.emotion);
    setEmotionalState(nextEmotionalState);
    setDismissed(false);
    setVisible(true);
    const nextCard = payload.card ?? getLokiSuggestion({ eventType, activePanel, payload });
    setCard(nextCard);
    activeHistoryIdRef.current = null;
    if (settings.enabled && settings.bubbleEnabled) {
      const emotionalPayload = { ...payload, ...getLokiEmotionalPayload(nextEmotionalState) };
      const nextMessage = getLokiPhrase(eventType, emotionalPayload);
      setMessage(nextMessage);
      const memoryPatch = {
        lastMessage: { eventType, text: nextMessage, payload: emotionalPayload },
        lastPanel: activePanel,
        inDialog: true,
        emotionalState: nextEmotionalState,
      };
      if (eventType === LOKI_EVENTS.PROACTIVE_SUGGESTION) {
        memoryPatch.lastRecommendation = {
          adviceId: payload.adviceId ?? null,
          reason: payload.reason ?? null,
          card: nextCard,
          panel: activePanel,
          shownAt: new Date().toISOString(),
        };
      }
      updateMemory(memoryPatch);
      updateHistory(prev => {
        const item = {
          kind: payload.kind ?? 'message',
          adviceId: payload.adviceId ?? null,
          eventType,
          text: nextMessage,
          card: nextCard,
          priority,
          panel: activePanel,
          emotion: nextEmotionalState.mood,
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
    }, Math.min(3600, Math.max(1600, emotionalPresentation.duration - 2200)));
    hideTimerRef.current = setTimeout(() => {
      setMessage('');
      setCard(null);
      setEmotion(eventType === LOKI_EVENTS.USER_IDLE ? 'sleep' : 'idle');
    }, emotionalPresentation.duration);
    if (eventType === LOKI_EVENTS.PROACTIVE_SUGGESTION || activePanel !== 'home') {
      farewellTimerRef.current = setTimeout(() => {
        setAction(LOKI_ACTIONS.WAVE);
        setEmotion('happy');
      }, emotionalPresentation.duration + 520);
    }
    presenceTimerRef.current = setTimeout(() => {
      const shouldStayHome = activePanel === 'home' && settings.enabled && !isHiddenOnPanel;
      setVisible(shouldStayHome);
      setAnchor('home');
      setAction(LOKI_ACTIONS.IDLE);
      setEmotion('idle');
      currentPriorityRef.current = LOKI_MESSAGE_PRIORITY.LOW;
      updateMemory({ inDialog: false, lastPanel: activePanel, emotionalState: nextEmotionalState });
      const next = queueRef.current.shift();
      if (next) setTimeout(() => displayMessage(next.eventType, next.payload), 420);
    }, emotionalPresentation.duration + 1900);
  }, [activePanel, emotionalState, isHiddenOnPanel, settings.bubbleEnabled, settings.enabled, updateHistory, updateMemory]);

  const showMessage = useCallback((eventType, payload = {}) => {
    if (!settings.enabled) return;
    const config = getBehaviorForEvent(eventType);
    const priority = payload.priority ?? config.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL;
    if (shouldLokiStayQuiet({ eventType, priority, emotionalState })) return;
    const item = { eventType, payload: { ...payload, priority } };
    const hasActiveMessage = visible && (message || card);
    if (hasActiveMessage && priority <= currentPriorityRef.current) {
      queueRef.current = [...queueRef.current, item]
        .sort((a, b) => (b.payload.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL) - (a.payload.priority ?? LOKI_MESSAGE_PRIORITY.NORMAL))
        .slice(0, 8);
      return;
    }
    displayMessage(eventType, item.payload);
  }, [card, displayMessage, emotionalState, message, visible]);

  useEffect(() => subscribeLoki(showMessage), [showMessage]);

  useEffect(() => {
    if (!user?.lokiSettings || settingsHydratedRef.current) return;
    settingsHydratedRef.current = true;
    persistSettings({ ...DEFAULT_LOKI_SETTINGS, ...loadLokiSettings(), ...user.lokiSettings }, { sync: false });
  }, [persistSettings, user?.lokiSettings]);

  useEffect(() => {
    if (!user?.id || user.isGuest) return;
    if (!settingsDirtyRef.current) return;
    userAction('loki:settings', { userId: String(user.id), settings })
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
    if (!settings.enabled || !user || activePanel !== 'home' || isHiddenOnPanel || dismissed || experienceOpen) return undefined;
    if (homePresenceTimerRef.current) clearTimeout(homePresenceTimerRef.current);
    homePresenceTimerRef.current = setTimeout(() => {
      setAnchor('home');
      setVisible(true);
      setEmotion(prev => (prev === 'sleep' ? 'sleep' : 'idle'));
      setAction(LOKI_ACTIONS.PEEK);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
      actionTimerRef.current = setTimeout(() => {
        setAction(LOKI_ACTIONS.IDLE);
        setEmotion('idle');
      }, 1800);
    }, message || card ? 2600 : 760);
    return () => {
      if (homePresenceTimerRef.current) clearTimeout(homePresenceTimerRef.current);
    };
  }, [activePanel, card, dismissed, experienceOpen, isHiddenOnPanel, message, settings.enabled, user]);

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
          const nextAction = getEmotionalMicroAction(emotionalState) ?? (shouldUseNightAction() ? LOKI_ACTIONS.YAWN : getRandomLokiAction());
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
  }, [emotionalState, message, settings.enabled, visible]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (microTimerRef.current) clearTimeout(microTimerRef.current);
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
    if (homePresenceTimerRef.current) clearTimeout(homePresenceTimerRef.current);
    if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
  }, []);

  useEffect(() => {
    lastPanelChangeAtRef.current = Date.now();
    setMemory(prev => {
      const panelVisits = { ...(prev.panelVisits ?? {}), [activePanel]: ((prev.panelVisits ?? {})[activePanel] ?? 0) + 1 };
      const next = { ...prev, lastPanel: activePanel, panelVisits, learning: learnFromPanelVisit(prev.learning, activePanel), updatedAt: new Date().toISOString() };
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
        userMemory,
        lastUserActionAt: lastUserActionAtRef.current,
        lastPanelChangeAt: lastPanelChangeAtRef.current,
      });
      if (recommendation) showMessage(recommendation.eventType, recommendation.payload);
    }, 9000);
    return () => {
      if (observerTimerRef.current) clearTimeout(observerTimerRef.current);
    };
  }, [activePanel, appState, history, memory, settings.enabled, showMessage, user, userMemory]);

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
    const activeAdvice = memory?.lastRecommendation;
    updateMemory({
      lastAction: { ...normalized, ts: new Date().toISOString() },
      inDialog: false,
      ...(activeAdvice ? { learning: learnFromRecommendationResult(memory.learning, activeAdvice, 'opened') } : {}),
    });
    if (activeHistoryIdRef.current) {
      const id = activeHistoryIdRef.current;
      updateHistory(prev => markLokiHistoryItem(prev, id, 'opened'));
    }
    try {
      await handler(normalized.payload ?? {});
      setCard(null);
      setMessage('');
      setAction(LOKI_ACTIONS.WAVE);
      setEmotion('happy');
      setTimeout(() => {
        if (activePanel !== 'home') setVisible(false);
      }, 520);
      return true;
    } catch (e) {
      logError(e, 'LokiProvider.executeAction');
      showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_action_failed', actionType: normalized.type, priority: LOKI_MESSAGE_PRIORITY.HIGH });
      return false;
    }
  }, [activePanel, appActions, memory, showMessage, updateHistory, updateMemory]);

  const askBrain = useCallback(async (text) => {
    if (!settings.enabled) return false;
    const thinkingTimer = setTimeout(() => {
      setVisible(true);
      setDismissed(false);
      setEmotion('thinking');
      setAction(LOKI_ACTIONS.LOOK_AROUND);
      setMessage('Думаю...');
      setCard(null);
      setBrainThinking(true);
    }, 1000);
    try {
      const result = await askLokiBrain({ text, appState: { ...appState, user, activePanel }, memory, userMemory, history, debug: isLokiDebugEnabled() });
      clearTimeout(thinkingTimer);
      setBrainThinking(false);
      setUserMemory(prev => learnFromLokiQuery(prev, text, result));
      if (result.executeAction) {
        setMessage('Показываю.');
        await executeAction(result.executeAction);
        return true;
      }
      showMessage(LOKI_EVENTS.BRAIN_RESPONSE, {
        source: 'loki_brain',
        message: result.text,
        card: result.card,
        priority: LOKI_MESSAGE_PRIORITY.HIGH,
      });
      return true;
    } catch (e) {
      clearTimeout(thinkingTimer);
      setBrainThinking(false);
      logError(e, 'LokiProvider.askBrain');
      showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_brain', priority: LOKI_MESSAGE_PRIORITY.HIGH });
      return false;
    }
  }, [activePanel, appState, executeAction, history, memory, settings.enabled, showMessage, user, userMemory]);

  const askExperience = useCallback(async (text, options = {}) => {
    if (!settings.enabled) return null;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setBrainThinking(true);
    setEmotion('thinking');
    setAction(LOKI_ACTIONS.LOOK_AROUND);
    updateMemory({ inDialog: true, lastPanel: activePanel, lastUserText: text });
    try {
      const result = await askLokiBrain({ text, appState: { ...appState, user, activePanel }, memory, userMemory, history, debug: isLokiDebugEnabled() });
      setBrainThinking(false);
      setEmotion(result.executeAction || result.autoAction ? 'excited' : 'helper');
      setAction(result.executeAction || result.autoAction ? LOKI_ACTIONS.POINT : LOKI_ACTIONS.LISTEN);
      updateMemory({
        lastMessage: { eventType: LOKI_EVENTS.BRAIN_RESPONSE, text: result.text, payload: { card: result.card, cards: result.cards } },
        lastConversation: { userText: text, answer: result.text, action: result.executeAction ?? result.autoAction ?? result.card?.action ?? null },
        lastPanel: activePanel,
        inDialog: true,
      });
      setUserMemory(prev => learnFromLokiQuery(prev, text, result));
      userAction('loki:analytics', {
        payload: {
          query: text,
          intent: result.intent,
          resultCount: result.cards?.length || (result.card ? 1 : 0),
          actionType: result.executeAction?.type || result.autoAction?.type || result.card?.action?.type || '',
          panel: activePanel,
          ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
          success: true,
          source: 'loki_experience',
        },
      }).catch(e => logError(e, 'LokiProvider.analytics'));
      updateHistory(prev => addLokiHistoryItem(prev, {
        kind: 'brain',
        eventType: LOKI_EVENTS.BRAIN_RESPONSE,
        text: result.text,
        card: result.card,
        priority: LOKI_MESSAGE_PRIORITY.HIGH,
        panel: activePanel,
      }));
      const actionToRun = result.executeAction ?? (options.autoExecute ? result.autoAction : null);
      if (actionToRun) setTimeout(() => executeAction(actionToRun), 420);
      return result;
    } catch (e) {
      setBrainThinking(false);
      logError(e, 'LokiProvider.askExperience');
      showMessage(LOKI_EVENTS.APP_ERROR, { source: 'loki_experience', priority: LOKI_MESSAGE_PRIORITY.HIGH });
      return {
        text: 'Что-то пошло не так. Сейчас попробуем разобраться.',
        card: null,
        cards: [],
      };
    }
  }, [activePanel, appState, executeAction, history, memory, settings.enabled, showMessage, updateHistory, updateMemory, user, userMemory]);

  const value = useMemo(() => ({
    action,
    activePanel,
    anchor,
    askBrain,
    askExperience,
    brainThinking,
    canTalk,
    card,
    dismissed,
    emotion,
    emotionalState,
    executeAction,
    experienceOpen,
    isHiddenOnPanel,
    lastEvent,
    history,
    interestProfile: buildInterestProfile({ appState: { ...appState, user, activePanel }, memory, userMemory }),
    recommendationFeed: buildRecommendationFeed({ appState: { ...appState, user, activePanel }, memory, userMemory, limit: 8 }),
    scenarioCollections: buildScenarioCollections({ appState: { ...appState, user, activePanel }, memory, userMemory }).filter(item => item.cards.length),
    memory: memory ?? DEFAULT_LOKI_MEMORY,
    userMemory,
    message,
    settings,
    handleCharacterTap,
    showMessage,
    resetUserMemory,
    visible,
    openExperience: () => {
      setExperienceOpen(true);
      setVisible(false);
      setDismissed(false);
      updateMemory({ inDialog: true, lastPanel: activePanel });
    },
    closeExperience: () => {
      setExperienceOpen(false);
      setAction(LOKI_ACTIONS.WAVE);
      setEmotion('happy');
      updateMemory({ inDialog: false, lastPanel: activePanel });
    },
    hide: () => {
      if (activeHistoryIdRef.current) {
        const id = activeHistoryIdRef.current;
        updateHistory(prev => markLokiHistoryItem(prev, id, 'ignored'));
      }
      if (memory?.lastRecommendation) {
        updateMemory({ learning: learnFromRecommendationResult(memory.learning, memory.lastRecommendation, 'ignored') });
      }
      setAction(LOKI_ACTIONS.WAVE);
      setEmotion('happy');
      setMessage('');
      setCard(null);
      setDismissed(true);
      setTimeout(() => setVisible(false), 360);
    },
    show: () => { setDismissed(false); setVisible(true); },
    hideCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: [...new Set([...settings.hiddenPanels, activePanel])] }),
    showCurrentPanel: () => persistSettings({ ...settings, hiddenPanels: settings.hiddenPanels.filter(panel => panel !== activePanel) }),
    setHintsEnabled: (enabled) => persistSettings({ ...settings, enabled }),
    setBubbleEnabled: (bubbleEnabled) => persistSettings({ ...settings, bubbleEnabled }),
  }), [action, activePanel, anchor, appState, askBrain, askExperience, brainThinking, canTalk, card, dismissed, emotion, emotionalState, executeAction, experienceOpen, handleCharacterTap, history, isHiddenOnPanel, lastEvent, memory, message, persistSettings, resetUserMemory, settings, showMessage, updateHistory, updateMemory, user, userMemory, visible]);

  return <LokiContext.Provider value={value}>{children}</LokiContext.Provider>;
}

export function useLoki() {
  const value = useContext(LokiContext);
  if (!value) throw new Error('useLoki must be used inside LokiProvider');
  return value;
}
