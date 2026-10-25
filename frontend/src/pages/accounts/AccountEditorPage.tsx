import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../../hooks/useAccounts';
import { accountApi } from '../../services/accountApi';
import { useAppStore } from '../../store/useAppStore';
import type { AccountInput } from '../../types/accounts';
import AccountForm from '../../components/accounts/AccountForm';
import Alert from '../../components/ui/Alert';

export default function AccountEditorPage({ mode }: { mode: 'create' }) {
  const navigate = useNavigate();
  const { accounts, employees, loading, loadError, reload } = useAccounts();
  async function save(input: AccountInput) {
    try {
      await accountApi.create(input);
      useAppStore.getState().setNotice('Đã tạo tài khoản thành công.');
      navigate('/accounts'); return null;
    } catch (cause) { return cause instanceof Error ? cause.message : 'Không tạo được tài khoản.'; }
  }
  if (loading) return <p className="loading-state" role="status">Đang tải tài khoản…</p>;
  if (loadError) return <Alert>{loadError}<button className="button" onClick={() => void reload()}>Tải lại</button></Alert>;
  return <AccountForm mode={mode} accounts={accounts} employees={employees}
    onBack={() => navigate('/accounts')} onSave={save} />;
}
