console.log(JSON.stringify({
  ok: true,
  mode: 'locked_local_account_cutover',
  cutover: 'LOCKED',
  reason: 'Account Core cutover is forbidden in v1 implementation branch.',
  productionChanged: false,
}, null, 2));
