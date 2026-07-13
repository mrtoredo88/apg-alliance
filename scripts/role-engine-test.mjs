import assert from 'node:assert/strict';
import {
  CAPABILITIES,
  getPrimaryRole,
  getRoleCapabilities,
  getRoleDiagnostics,
  getRolePermissions,
  getUnknownRoles,
  getUserRoles,
  hasCapability,
  hasPermission,
  hasRole,
  isRoleWithinRolloutStage,
  normalizeRole,
  PERMISSIONS,
  ROLES,
} from '../server-shared/role-engine.js';

assert.equal(normalizeRole('OWNER'), ROLES.owner);
assert.equal(normalizeRole('administrator'), ROLES.admin);
assert.equal(normalizeRole('super_admin'), ROLES.superAdmin);
assert.equal(normalizeRole('unknown-role'), '');

assert.deepEqual(getUserRoles({}), [ROLES.user]);
assert.deepEqual(getUserRoles({ role: 'super_admin' }), [ROLES.superAdmin]);
assert.equal(getPrimaryRole({ roles: ['partner', 'admin'] }), ROLES.admin);
assert.equal(getPrimaryRole({ role: 'super_admin', owner: true }), ROLES.owner);

const partnerIdentity = { role: 'user', partnerId: 'partner-1' };
assert.deepEqual(getUserRoles(partnerIdentity).sort(), [ROLES.partner, ROLES.user]);
assert.equal(hasRole(partnerIdentity, ROLES.partner), true);
assert.equal(hasCapability(partnerIdentity, CAPABILITIES.canUseBusinessHub), true);
assert.equal(hasCapability(partnerIdentity, CAPABILITIES.canUseWorkspace), true);
assert.equal(hasPermission(partnerIdentity, PERMISSIONS.businessProfileManage), true);
assert.equal(hasPermission(partnerIdentity, PERMISSIONS.workspaceOpen), true);

const expertIdentity = { roles: ['expert'], expertCabinetEnabled: true };
assert.equal(hasCapability(expertIdentity, CAPABILITIES.canUseWorkspace), true);
assert.equal(hasCapability(expertIdentity, CAPABILITIES.canManageOwnExpertProfile), true);
assert.equal(hasPermission(expertIdentity, PERMISSIONS.contentCreate), true);

const superAdminIdentity = { role: 'super_admin' };
assert.equal(getPrimaryRole(superAdminIdentity), ROLES.superAdmin);
assert.deepEqual(getUserRoles(superAdminIdentity), [ROLES.superAdmin]);
assert.equal(hasRole(superAdminIdentity, ROLES.owner), false);
assert.equal(hasCapability(superAdminIdentity, CAPABILITIES.canUseWorkspace), true);
assert.equal(hasCapability(superAdminIdentity, CAPABILITIES.canOpenAdminPanel), true);
assert.equal(hasPermission(superAdminIdentity, PERMISSIONS.systemManage), true);
assert.equal(isRoleWithinRolloutStage(superAdminIdentity, ROLES.owner), true);

const ownerIdentity = { role: 'owner' };
assert.equal(hasRole(ownerIdentity, ROLES.owner), true);
assert.equal(hasCapability(ownerIdentity, CAPABILITIES.canViewDiagnostics), true);
assert.equal(isRoleWithinRolloutStage(ownerIdentity, ROLES.owner), true);

const adminIdentity = { role: 'admin' };
assert.equal(isRoleWithinRolloutStage(adminIdentity, ROLES.owner), false);
assert.equal(isRoleWithinRolloutStage(adminIdentity, ROLES.admin), true);
assert.equal(isRoleWithinRolloutStage(adminIdentity, ROLES.partner), true);

const userIdentity = { role: 'user' };
assert.equal(hasCapability(userIdentity, CAPABILITIES.canUseUserMode), true);
assert.equal(hasCapability(userIdentity, CAPABILITIES.canUseWorkspace), false);
assert.equal(isRoleWithinRolloutStage(userIdentity, 'all'), true);

const diagnostics = getRoleDiagnostics({ role: 'legacy-boss', roles: ['partner', 'administrator'] });
assert.deepEqual(diagnostics.roles.sort(), [ROLES.admin, ROLES.partner]);
assert.deepEqual(diagnostics.unknownRoles, ['legacy-boss']);
assert.equal(diagnostics.primaryRole, ROLES.admin);
assert.ok(diagnostics.permissions.includes(PERMISSIONS.adminOpen));
assert.ok(diagnostics.capabilities.includes(CAPABILITIES.canOpenAdminPanel));

assert.deepEqual(getUnknownRoles({ roles: ['owner', 'ghost', 'administrator', 'ghost'] }), ['ghost']);
assert.ok(getRolePermissions({ role: 'owner' }).includes(PERMISSIONS.usersManage));
assert.ok(getRoleCapabilities({ role: 'moderator' }).includes(CAPABILITIES.canModerateContent));

console.log('Role Engine V1 contract test passed');
