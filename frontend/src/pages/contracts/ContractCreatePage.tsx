import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contractApi } from '../../services/contractApi';
import { employeeApi } from '../../services/employeeApi';
import { useAppStore } from '../../store/useAppStore';
import type { Employee } from '../../types/accounts';
import ContractForm from '../../components/contracts/ContractForm';
import Alert from '../../components/ui/Alert';

export default function ContractCreatePage() {
  const navigate = useNavigate();
  const setNotice = useAppStore(state => state.setNotice);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeApi.list().then(setEmployees).catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được danh sách nhân viên.'));
  }, []);

  if (error) return <div className="account-form-page"><Alert>{error}</Alert><button className="button" onClick={() => navigate('/contracts')}>Quay lại danh sách</button></div>;
  if (!employees) return <p className="loading-state" role="status">Đang tải danh sách nhân viên…</p>;

  return <ContractForm mode="create" employees={employees} onBack={() => navigate('/contracts')} onSave={async value => {
    try {
      const created = await contractApi.create(value);
      setNotice(`Đã tạo hợp đồng ${created.contractCode}.`);
      navigate(`/contracts/${created.contractId}`);
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'Không tạo được hợp đồng.';
    }
  }} />;
}
