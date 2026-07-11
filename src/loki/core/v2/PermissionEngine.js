const ROLE_PERMISSIONS = {
  user: ['read:public', 'navigate:self', 'memory:self'],
  partner: ['read:public', 'navigate:self', 'memory:self', 'draft:partner'],
  expert: ['read:public', 'navigate:self', 'memory:self', 'draft:expert'],
  analyst: ['read:public', 'read:analytics'],
  moderator: ['read:public', 'read:admin', 'draft:moderation'],
  editor: ['read:public', 'read:admin', 'draft:content'],
  admin: ['read:public', 'read:admin', 'draft:content', 'draft:operations'],
  super_admin: ['*'],
  owner: ['*'],
  automation: ['read:public', 'draft:automation'],
};

export function getRolePermissions(role, explicitPermissions = []) {
  return new Set([...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user), ...explicitPermissions]);
}

export function canUsePermissions(role, requiredPermissions = [], explicitPermissions = []) {
  const permissions = getRolePermissions(role, explicitPermissions);
  return permissions.has('*') || requiredPermissions.every(permission => permissions.has(permission));
}

export function assertActionAllowed({ role = 'user', requiredPermissions = [], permissions = [] }) {
  if (!canUsePermissions(role, requiredPermissions, permissions)) {
    const error = new Error('Недостаточно прав для этого действия');
    error.code = 'LOKI_PERMISSION_DENIED';
    throw error;
  }
}

export { ROLE_PERMISSIONS as LOKI_ROLE_PERMISSIONS };
