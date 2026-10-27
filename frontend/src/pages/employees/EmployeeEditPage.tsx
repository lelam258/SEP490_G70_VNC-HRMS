import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeApi } from '../../services/employeeApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import { useAppStore } from '../../store/useAppStore';
import type { EmployeeDetail, UpdateEmployeeInput } from '../../types/accounts';
import EmployeeProfileForm from '../../components/employees/EmployeeProfileForm';
import Alert from '../../components/ui/Alert';

export default function EmployeeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [staffData, deptData] = await Promise.all([
        employeeApi.get(id),
        departmentApi.list(),
      ]);
      setEmployee(staffData);
      setDepartments(deptData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ nhân viên.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [id]);

  async function handleSave(input: UpdateEmployeeInput): Promise<string | null> {
    if (!id) return 'ID nhân viên không hợp lệ.';
    try {
      await employeeApi.update(id, input);
      useAppStore.getState().setNotice('Đã cập nhật hồ sơ nhân viên thành công.');
      navigate(`/employees/${id}`);
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ nhân viên.';
    }
  }

  if (loading) {
    return <p className="loading-state" role="status">Đang tải hồ sơ nhân viên…</p>;
  }

  if (error || !employee) {
    return (
      <div className="account-form-page">
        <Alert variant="error">
          {error || 'Không tìm thấy hồ sơ nhân viên.'}
          <div style={{ marginTop: 12 }}>
            <button className="button" onClick={() => navigate('/employees')}>
              Quay lại danh sách
            </button>
            <button className="button primary" style={{ marginLeft: 8 }} onClick={() => void loadData()}>
              Thử lại
            </button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <EmployeeProfileForm
      mode="edit"
      employee={employee}
      departments={departments}
      onBack={() => navigate(`/employees/${id}`)}
      onSave={handleSave}
    />
  );
}
