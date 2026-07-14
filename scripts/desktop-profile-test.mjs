import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profileSource = readFileSync(new URL('../src/ProfilePanel.jsx', import.meta.url), 'utf8');
const userAppSource = readFileSync(new URL('../src/UserApp.jsx', import.meta.url), 'utf8');

assert.ok(profileSource.includes('data-desktop-user-profile'), 'desktop profile branch must be explicit');
assert.ok(profileSource.includes('if (desktopMode)'), 'desktop profile must be gated by desktopMode');
assert.ok(userAppSource.includes('desktopMode={desktopDevice}'), 'UserApp must pass desktopMode to ProfilePanel');
assert.ok(userAppSource.includes("onBack={() => goPanel('home')}"), 'desktop profile back action must return to user app');

const desktopBranch = profileSource.slice(
  profileSource.indexOf('if (desktopMode)'),
  profileSource.indexOf('return (', profileSource.indexOf('if (desktopMode)') + 1),
);

assert.ok(profileSource.includes('DesktopProfileEditor'), 'desktop profile should open the profile editor');
assert.ok(profileSource.includes('DesktopBookingRow'), 'desktop profile should show compact booking rows');
assert.ok(profileSource.includes('DesktopFavoriteRow'), 'desktop profile should show compact favorite rows');
assert.ok(profileSource.includes('DesktopNewsRow'), 'desktop profile should show compact saved news rows');
assert.ok(!profileSource.includes('WorkspaceRelatedLinks'), 'user profile must not embed Workspace related links');
assert.ok(!profileSource.includes('WorkspaceDialogsCRM'), 'user profile must not embed Workspace CRM dialogs');
assert.ok(!profileSource.includes('DesktopWorkspace'), 'user profile must not embed Desktop Workspace');
assert.ok(!desktopBranch.includes('NAV_ITEMS'), 'desktop profile must not add a left Workspace navigation');

console.log('Desktop Profile regression test passed');
