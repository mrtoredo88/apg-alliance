import { evaluateConversationEligibility, normalizeSocialPrivacy } from './ConversationEligibility.js';

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function buildSocialMessagingSnapshot(input = {}) {
  const requests = list(input.requests);
  const blocked = list(input.blocked);
  const eligibility = input.actor && input.target
    ? evaluateConversationEligibility(input)
    : null;
  return {
    enabled: true,
    source: 'existing-messaging-platform',
    dialogType: 'direct',
    privacy: normalizeSocialPrivacy(input.privacy || input.actor?.socialMessagingPrivacy),
    eligibility,
    requests: {
      pending: requests.filter(item => item.status === 'pending').length,
      accepted: requests.filter(item => item.status === 'accepted').length,
      declined: requests.filter(item => item.status === 'declined').length,
      expired: requests.filter(item => item.status === 'expired').length,
    },
    blocked: blocked.length,
    rateLimit: {
      window: '24h',
      maxRequests: 10,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function buildSocialMessagingDevPanel(input = {}) {
  const snapshot = buildSocialMessagingSnapshot(input);
  return {
    title: 'Social Messaging',
    Eligibility: snapshot.eligibility?.eligible ?? null,
    Reason: snapshot.eligibility?.reason || '',
    RequestStatus: snapshot.eligibility?.requestStatus || '',
    Privacy: snapshot.privacy,
    Blocked: snapshot.blocked,
    Relationship: snapshot.eligibility?.reason || 'none',
    snapshot,
  };
}
