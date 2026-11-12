import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { roles } = await server.ssrLoadModule('/src/types/accounts.ts');
  const { loginDestination, roleHome } = await server.ssrLoadModule('/src/utils/roleNavigation.ts');
  assert.equal(roles.length, 6);
  assert.equal(roleHome('hr_staff'), '/schedules');
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
    assert.equal(loginDestination(role, '/schedules'), '/schedules');
    assert.equal(loginDestination(role, '/roles'), role === 'admin' ? '/roles' : roleHome(role));
    assert.equal(loginDestination(role, '/audit-logs'), role === 'admin' ? '/audit-logs' : roleHome(role));
    assert.equal(loginDestination(role, '/attendance/records'), role !== 'accountant' ? '/attendance/records' : roleHome(role));
    assert.equal(loginDestination(role, '/attendance/history'), role !== 'employee' ? '/attendance/history' : roleHome(role));
    assert.equal(loginDestination(role, '/attendance/imports/new'), role === 'hr_staff' ? '/attendance/imports/new' : roleHome(role));
    assert.equal(loginDestination(role, '/attendance/device-mappings'), ['admin', 'hr_manager', 'hr_staff'].includes(role) ? '/attendance/device-mappings' : roleHome(role));
    assert.equal(loginDestination(role, '/attendance/import-periods'), roleHome(role));
    assert.equal(loginDestination(role, '/attendance/on-call/new'), role === 'hr_staff' ? '/attendance/on-call/new' : roleHome(role));
    const attendanceId = '00000000-0000-4000-8000-000000000001';
    const importPreview = `/attendance/imports/${attendanceId}/preview`;
    assert.equal(loginDestination(role, importPreview), ['admin', 'hr_manager', 'hr_staff'].includes(role) ? importPreview : roleHome(role));
    const dutyEdit = `/attendance/on-call/${attendanceId}/edit`;
    assert.equal(loginDestination(role, dutyEdit), role === 'hr_staff' ? dutyEdit : roleHome(role));
    for (const from of ['//untrusted.example', '/\\untrusted.example', 'https://untrusted.example', '/payroll']) {
      assert.equal(loginDestination(role, from), roleHome(role));
    }
  }
  console.log('PASS: six roles, role-specific login destinations, self-service screens for non-admin, and unauthorized/external redirect rejection.');
} finally { await server.close(); }
