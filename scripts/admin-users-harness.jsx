import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminUsersPanel } from '../src/AdminPanel.jsx';

const users = [
  { id: 'user-a', name: 'Яков Петров', email: 'same@example.com', keys: 5, role: 'user', accountStatus: 'active' },
  { id: 'user-b', name: 'Анна Петрова', linkedEmail: 'same@example.com', keys: 2, role: 'user', accountStatus: 'active' },
  { id: 'user-c', name: 'Борис Петров', phone: '+79990000000', keys: 1, role: 'user', accountStatus: 'active' },
  { id: 'user-archived', name: 'Архивный Пользователь', email: 'archive@example.com', archived: true, accountStatus: 'archived' },
];
const group = { id: 'group-1', score: 100, confidence: 'high', reasons: [{ label: 'Email' }], users: users.slice(0, 3) };
window.__adminHarnessActions = [];

async function onAction(action, payload) {
  window.__adminHarnessActions.push({ action, payload });
  if (action === 'user-accounts:duplicates') return { ok: true, groups: [group] };
  if (action === 'user-accounts:merge-preview') return { ok: true, preview: { referenceCount: 3, totals: { keys: 8, tickets: 0, aliases: 2 }, stateToken: 'preview-token', requiresPrivilegedConfirmation: false } };
  return { ok: true };
}

createRoot(document.getElementById('root')).render(
  <AdminUsersPanel users={users} activity={[]} onAction={onAction} onRefresh={async () => {}} canDeleteUsers canManageRoles />
);
