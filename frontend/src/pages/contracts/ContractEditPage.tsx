import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contractApi } from '../../services/contractApi';
import { useAppStore } from '../../store/useAppStore';
import type { ContractDetail } from '../../types/contract';
import ContractForm from '../../components/contracts/ContractForm';
import Alert from '../../components/ui/Alert';

export default function ContractEditPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setNotice = useAppStore(state => state.setNotice);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    contractApi.get(id).then(setContract).catch(cause => setError(cause instanceof Error ? cause.message : 'Không tải được hợp đồng.'));
  }, [id]);

  if (error) return <div className="account-form-page"><Alert>{error}</Alert><button className="button" onClick={() => navigate('/contracts')}>Quay lại danh sách</button></div>;
  if (!contract) return <p className="loading-state" role="status">Đang tải hợp đồng…</p>;

  return <ContractForm mode="edit" contract={contract} onBack={() => navigate(`/contracts/${id}`)} onSave={async value => {
    try {
      await contractApi.update(id, value);
      setNotice('Đã cập nhật hợp đồng.');
      navigate(`/contracts/${id}`);
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'Không lưu được hợp đồng.';
    }
  }} />;
}
