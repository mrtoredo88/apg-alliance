export function hasAccountPermission(account = {}, permission = '') {
  if (!permission) return false;
  const permissions = Array.isArray(account.permissions) ? account.permissions : [];
  const roles = Array.isArray(account.roles) ? account.roles : [];
  return permissions.includes(permission) || roles.includes('owner') || roles.includes('admin');
}
