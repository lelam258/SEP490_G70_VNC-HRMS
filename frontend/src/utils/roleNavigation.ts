export function roleHome(role: string): string {
  if (role === 'admin') return '/accounts';
  if (role === 'hr_manager') return '/employees';
  if (role === 'accountant') return '/payroll/parameters';
  if (role === 'department_head') return '/compliance';
  return '/';
}

// Respect a protected deep link only if it belongs to this role's available screens.
export function loginDestination(role: string, from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return roleHome(role);
  const url = new URL(from, 'https://vnc.local');
  if (url.origin !== 'https://vnc.local') return roleHome(role);
  const path = url.pathname;
  const isSelfService = role !== 'admin' && (path === '/me/profile' || path === '/me/leave-requests' || path === '/me/leave-requests/new');
  const permitted = path === '/' || path === '/change-password'
    || (role === 'admin' && (path === '/accounts' || path.startsWith('/accounts/') || path === '/compliance'))
    || (role === 'department_head' && path === '/compliance')
    || (role === 'hr_manager' && (path === '/employees' || path.startsWith('/employees/') || ['/departments', '/organization', '/compliance', '/certificates', '/cme-records'].includes(path) || path.startsWith('/certificates/') || path.startsWith('/cme-records/')))
    || (role === 'accountant' && (path === '/payroll/parameters' || path === '/payroll/compensation' || path === '/payroll/periods' || path.startsWith('/payroll/periods/')))
    || isSelfService;
  return permitted ? url.pathname + url.search + url.hash : roleHome(role);
}
