export function roleHome(_role: string): string {
  return '/';
}

// Respect a protected deep link only if it belongs to this role's available screens.
export function loginDestination(role: string, from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return roleHome(role);
  const url = new URL(from, 'https://vnc.local');
  if (url.origin !== 'https://vnc.local') return roleHome(role);
  const path = url.pathname;
  const isSelfService = role !== 'admin' && (path === '/me/profile' || path === '/me/certificates' || path === '/me/cme-records' || path === '/me/leave-requests' || path === '/me/leave-requests/new');
  const attendanceRead = role !== 'accountant' && (['/attendance', '/attendance/records', '/attendance/on-call'].includes(path)
    || /^\/attendance\/(records|on-call)\/[a-f0-9-]{36}$/i.test(path));
  const importRead = ['admin', 'hr_manager', 'hr_staff'].includes(role)
    && (path === '/attendance/imports' || /^\/attendance\/imports\/[a-f0-9-]{36}\/(preview|errors)$/i.test(path));
  const attendanceWrite = role === 'hr_staff' && (path === '/attendance/records/new' || path === '/attendance/imports/new' || path === '/attendance/on-call/new'
    || /^\/attendance\/on-call\/[a-f0-9-]{36}\/edit$/i.test(path));
  const historyRead = role !== 'employee' && (path === '/attendance/history' || path === '/attendance/monthly');
  const deviceMappingsRead = ['admin', 'hr_manager', 'hr_staff'].includes(role) && path === '/attendance/device-mappings';
  const procedurePermitted =
    (role !== 'admin' && (path === '/procedures' || /^\/procedures\/[a-f0-9-]{36}$/i.test(path)))
    || (['hr_manager', 'department_head', 'employee'].includes(role) && path === '/procedures/new')
    || (['hr_manager', 'department_head', 'employee', 'accountant'].includes(role) && /^\/procedures\/[a-f0-9-]{36}\/edit$/i.test(path));
  const permitted = path === '/' || path === '/change-password' || path === '/schedules'
    || procedurePermitted
    || (role === 'admin' && (path === '/accounts' || path.startsWith('/accounts/') || ['/compliance', '/roles', '/audit-logs'].includes(path)))
    || (role === 'department_head' && (path === '/compliance' || path === '/payroll/commission-results'))
    || (role === 'hr_manager' && (path === '/employees' || path.startsWith('/employees/') || ['/departments', '/organization', '/compliance', '/certificates', '/cme-records'].includes(path) || path.startsWith('/certificates/') || path.startsWith('/cme-records/')))
    || (role === 'accountant' && (path === '/payroll/parameters' || path === '/payroll/compensation' || path === '/payroll/periods' || path.startsWith('/payroll/periods/') || path === '/payroll/procedures' || path === '/payroll/commission-results' || path === '/payroll/procedure-services' || path.startsWith('/payroll/procedure-services/')))
    || isSelfService || attendanceRead || importRead || attendanceWrite || historyRead || deviceMappingsRead;
  return permitted ? url.pathname + url.search + url.hash : roleHome(role);
}
