export const MemoryEngine = {
  id: 'memory',
  label: 'Memory Engine',
  enrich({ context, memory, userMemory }) {
    return {
      ...context,
      memory: {
        lastAction: memory?.lastMessage?.payload?.card?.action ?? memory?.lastAction ?? null,
        lastMessage: memory?.lastMessage ?? null,
        lastConversation: memory?.lastConversation ?? null,
        lastPanel: memory?.lastPanel ?? context.user.currentPanel ?? null,
        activeContext: memory?.activeContext ?? null,
        lastContext: memory?.lastContext ?? null,
        preferences: memory?.preferences ?? {},
      },
      userMemory: userMemory ?? {},
    };
  },
};
