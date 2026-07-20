export function canOpenWorkspace(account = {}) {
  const roles = Array.isArray(account.roles) ? account.roles : [];
  return roles.some(role => ['owner', 'admin', 'partner', 'expert', 'manager'].includes(role));
}

export function canOpenCabinet(account = {}, type = '') {
  const roles = Array.isArray(account.roles) ? account.roles : [];
  if (roles.includes('owner') || roles.includes('admin')) return true;
  if (type === 'partner') return roles.includes('partner');
  if (type === 'expert') return roles.includes('expert');
  return false;
}
