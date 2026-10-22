import { useCallback, useEffect, useState } from 'react';
import { accountApi } from '../services/accountApi';
import type { Account, Employee } from '../types/accounts';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [users, staff] = await Promise.all([accountApi.list(), accountApi.employeeOptions()]);
      setAccounts(users); setEmployees(staff);
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { accounts, employees, loading, loadError, reload };
}
