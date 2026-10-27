export function roleHome(role: string): string {
  if (role === 'admin') return '/accounts';
  if (role === 'hr_manager') return '/employees';
  if (role === 'accountant') return '/payroll/parameters';
  return '/';
}

// Respect a protected deep link only if it belongs to this role's available screens.
export function loginDestination(role: string, from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return roleHome(role);
  const url = new URL(from, 'https://vnc.local');
  if (url.origin !== 'https://vnc.local') return roleHome(role);
  const path = url.pathname;
  const permitted = path === '/' || path === '/change-password'
    || (role === 'admin' && (path === '/accounts' || path.startsWith('/accounts/')))
    || (role === 'hr_manager' && ['/employees', '/departments', '/organization'].includes(path))
    || (role === 'accountant' && (path === '/payroll/parameters' || path === '/payroll/compensation'));
  return permitted ? url.pathname + url.search + url.hash : roleHome(role);
}
