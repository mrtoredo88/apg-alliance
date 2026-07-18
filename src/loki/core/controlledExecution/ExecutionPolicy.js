export const CONTROLLED_EXECUTION_POLICIES = {
  AUTO: 'AUTO',
  CONFIRM: 'CONFIRM',
  BLOCK: 'BLOCK',
};

const AUTO_CAPABILITIES = new Set([
  'OPEN_HOME',
  'OPEN_PROFILE',
  'OPEN_PARTNER',
  'OPEN_EXPERT',
  'OPEN_EVENT',
  'OPEN_EVENTS',
  'OPEN_NEWS',
  'OPEN_PROMOTION',
  'OPEN_PROMOTIONS',
  'OPEN_GIFTS',
  'OPEN_REWARDS',
  'OPEN_KEYS',
  'OPEN_DIALOG',
  'SEARCH_PARTNERS',
  'SEARCH_EVENTS',
  'SEARCH_NEWS',
  'SEARCH_PROMOTIONS',
  'SEARCH_EXPERTS',
]);

const CONFIRM_CAPABILITIES = new Set([
  'BOOK_APPOINTMENT',
  'SEND_MESSAGE',
  'CANCEL_BOOKING',
  'RESCHEDULE_BOOKING',
  'CREATE_EVENT',
  'DELETE_EVENT',
  'CREATE_PROMOTION',
  'ARCHIVE_PROMOTION',
]);

export function resolveExecutionPolicy(capability = '') {
  if (AUTO_CAPABILITIES.has(capability)) {
    return {
      policy: CONTROLLED_EXECUTION_POLICIES.AUTO,
      autoAllowed: true,
      confirmationRequired: false,
      reason: 'safe_navigation_or_search',
    };
  }
  if (CONFIRM_CAPABILITIES.has(capability)) {
    return {
      policy: CONTROLLED_EXECUTION_POLICIES.CONFIRM,
      autoAllowed: false,
      confirmationRequired: true,
      reason: 'state_changing_or_sensitive',
    };
  }
  return {
    policy: CONTROLLED_EXECUTION_POLICIES.BLOCK,
    autoAllowed: false,
    confirmationRequired: false,
    reason: 'capability_not_allowed',
  };
}

export function isAutoCapability(capability = '') {
  return AUTO_CAPABILITIES.has(capability);
}

export function isConfirmationCapability(capability = '') {
  return CONFIRM_CAPABILITIES.has(capability);
}

export class ExecutionPolicy {
  resolve(capability = '') {
    return resolveExecutionPolicy(capability);
  }
}
