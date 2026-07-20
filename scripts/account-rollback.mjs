console.log(JSON.stringify({
  ok: true,
  mode: 'local_account_rollback_plan',
  rollback: 'READY_BY_FLAGS',
  flags: {
    ACCOUNT_STORAGE: 'firestore',
    ACCOUNT_DUAL_READ: '0',
    ACCOUNT_DUAL_WRITE: '0',
    ACCOUNT_FALLBACK: '1',
    ACCOUNT_CANARY: '0',
  },
  rollbackExecuted: false,
  productionChanged: false,
}, null, 2));
