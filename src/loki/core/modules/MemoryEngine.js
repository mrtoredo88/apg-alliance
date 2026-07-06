export const MemoryEngine = {
  id: 'memory',
  label: 'Memory Engine',
  enrich({ context, memory }) {
    return {
      ...context,
      memory: {
        lastAction: memory?.lastMessage?.payload?.card?.action ?? memory?.lastAction ?? null,
        lastMessage: memory?.lastMessage ?? null,
        lastConversation: memory?.lastConversation ?? null,
        lastPanel: memory?.lastPanel ?? context.user.currentPanel ?? null,
        preferences: memory?.preferences ?? {},
      },
    };
  },
};
