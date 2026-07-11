import assert from 'node:assert/strict';
import { normalizeRole, selectCanonicalUserForTest } from '../server/src/lib/identityCore.js';
import { canUseDesktopWorkspace, DESKTOP_WORKSPACE_FLAG, getWorkspaceUserRoles } from '../src/workspace/WorkspaceFeatureFlags.js';

assert.equal(normalizeRole('OWNER'), 'owner');
assert.equal(normalizeRole('unknown'), '');

const ownerDoc = {
  id: 'firebase-owner-uid',
  data: {
    email: 'owner@example.com',
    role: 'owner',
    userRole: 'owner',
    adminStatus: 'active',
    firebaseUid: 'firebase-owner-uid',
  },
};

const legacyEmailPartner = {
  id: 'email:owner@example.com',
  data: {
    email: 'owner@example.com',
    role: 'partner',
    partnerId: 'partner-1',
  },
};

const selected = selectCanonicalUserForTest([legacyEmailPartner, ownerDoc]);
assert.equal(selected.id, 'firebase-owner-uid');

const roles = getWorkspaceUserRoles({
  user: {
    id: selected.id,
    role: selected.data.role,
    userRole: selected.data.userRole,
    roles: ['owner', 'partner'],
  },
});
assert.ok(roles.includes('owner'));
assert.ok(roles.includes('partner'));
assert.equal(canUseDesktopWorkspace({ user: { id: '988504' }, flag: DESKTOP_WORKSPACE_FLAG.owner }), false);
assert.equal(canUseDesktopWorkspace({ user: { id: selected.id, roles }, flag: DESKTOP_WORKSPACE_FLAG.owner }), true);

console.log('Identity Core smoke test passed');
