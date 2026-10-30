import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { roles } = await server.ssrLoadModule('/src/types/accounts.ts');
  const { loginDestination, roleHome } = await server.ssrLoadModule('/src/utils/roleNavigation.ts');
  assert.equal(roles.length, 6);
  for (const role of roles) {
    assert.equal(loginDestination(role, undefined), roleHome(role));
    assert.equal(loginDestination(role, '/accounts/new'), role === 'admin' ? '/accounts/new' : roleHome(role));
    assert.equal(loginDestination(role, '/employees'), role === 'hr_manager' ? '/employees' : roleHome(role));
    assert.equal(loginDestination(role, '/departments'), role === 'hr_manager' ? '/departments' : roleHome(role));
    assert.equal(loginDestination(role, '/payroll/parameters'), role === 'accountant' ? '/payroll/parameters' : roleHome(role));
    assert.equal(loginDestination(role, '/payroll/compensation'), role === 'accountant' ? '/payroll/compensation' : roleHome(role));
    assert.equal(loginDestination(role, '/payroll/periods'), role === 'accountant' ? '/payroll/periods' : roleHome(role));
    assert.equal(loginDestination(role, '/change-password'), '/change-password');
    assert.equal(loginDestination(role, '/me/profile'), role !== 'admin' ? '/me/profile' : roleHome(role));
    assert.equal(loginDestination(role, '/me/leave-requests'), role !== 'admin' ? '/me/leave-requests' : roleHome(role));
    assert.equal(loginDestination(role, '/me/leave-requests/new'), role !== 'admin' ? '/me/leave-requests/new' : roleHome(role));
    for (const from of ['//untrusted.example', '/\\untrusted.example', 'https://untrusted.example', '/payroll']) {
      assert.equal(loginDestination(role, from), roleHome(role));
    }
  }
  console.log('PASS: six roles, role-specific login destinations, self-service screens for non-admin, and unauthorized/external redirect rejection.');
} finally { await server.close(); }
