import { useNavigate, useParams } from 'react-router-dom';
import { useAccounts } from '../../hooks/useAccounts';
import { accountApi } from '../../services/accountApi';
import { useAppStore } from '../../store/useAppStore';
import type { AccountInput } from '../../types/accounts';
import AccountForm from '../../components/accounts/AccountForm';
import Alert from '../../components/ui/Alert';

export default function AccountEditorPage({ mode }: { mode: 'create' | 'detail' | 'edit' }) {
  const { id } = useParams(); const navigate = useNavigate();
  const { accounts, employees, loading, loadError, reload } = useAccounts();
  const account = accounts.find(value => value.id === id);
  async function save(input: AccountInput) {
    try {
      if (mode === 'create') await accountApi.create(input);
      else await accountApi.update(id!, input);
      useAppStore.getState().setNotice(mode === 'create' ? 'Đã tạo tài khoản thành công.' : 'Đã lưu thay đổi.');
      navigate('/accounts'); return null;
    } catch (cause) { return cause instanceof Error ? cause.message : 'Không lưu được tài khoản.'; }
  }
  if (loading) return <p className="loading-state" role="status">Đang tải tài khoản…</p>;
  if (loadError) return <Alert>{loadError}<button className="button" onClick={() => void reload()}>Tải lại</button></Alert>;
  if (mode !== 'create' && !account) return <Alert>Không tìm thấy tài khoản.</Alert>;
  return <AccountForm key={`${mode}-${id}-${account?.version || ''}`} mode={mode} account={account} accounts={accounts} employees={employees}
    onBack={() => navigate('/accounts')} onEdit={() => navigate(`/accounts/${id}/edit`)} onSave={save} />;
}
