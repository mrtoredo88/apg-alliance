export const USER_REFERENCE_FIELDS = ['userId', 'uid', 'ownerId', 'ownerUserId', 'createdBy', 'updatedBy', 'targetUserId', 'profileUserId', 'canonicalUserId', 'senderId', 'recipientId', 'fromUserId', 'toUserId'];
export const USER_REFERENCE_COLLECTIONS = ['partners', 'experts', 'events', 'scans', 'expertScans', 'raffleEntries', 'prizeClaims', 'expertReviews', 'conversationRequests', 'contextDialogs', 'notifications', 'guestSessions', 'telegramAuthSessions'];

export async function findUserReferences(db, userIds) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(String).filter(Boolean))];
  if (!ids.length) return [];

  const queries = USER_REFERENCE_COLLECTIONS.flatMap(collectionName =>
    USER_REFERENCE_FIELDS.map(async field => {
      const snap = await db.collection(collectionName).where(field, 'in', ids).limit(200).get().catch(() => null);
      return (snap?.docs || []).map(doc => ({
        key: `${collectionName}:${doc.id}:${field}`,
        collection: collectionName,
        id: doc.id,
        field,
        userId: String(doc.data()?.[field] || ''),
      }));
    }));

  const results = (await Promise.all(queries)).flat();
  return [...new Map(results.map(item => [item.key, item])).values()];
}
