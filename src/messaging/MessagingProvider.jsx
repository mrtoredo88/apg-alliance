import React, { createContext, useContext, useMemo } from 'react';
import { buildUnifiedDialogList } from './MessagingRouter.js';
import { buildMessagingSnapshot } from './MessagingSnapshot.js';

const MessagingContextValue = createContext(null);

export function MessagingProvider({ children, actor, dialogs = [], messages = [], filter = 'all', query = '' }) {
  const value = useMemo(() => {
    const list = buildUnifiedDialogList({ actor, dialogs, messages, filter, query });
    const snapshot = buildMessagingSnapshot({ actor, dialogs, messages });
    return { actor, dialogs: list, snapshot, realtime: snapshot.realtime };
  }, [actor, dialogs, messages, filter, query]);
  return <MessagingContextValue.Provider value={value}>{children}</MessagingContextValue.Provider>;
}

export function useMessaging() {
  return useContext(MessagingContextValue);
}
