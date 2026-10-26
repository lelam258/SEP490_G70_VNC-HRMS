import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import AccountListPage from '../pages/accounts/AccountListPage';
import AccountCreatePage from '../pages/accounts/AccountCreatePage';
import AccountDetailPage from '../pages/accounts/AccountDetailPage';
import AccountEditPage from '../pages/accounts/AccountEditPage';
import EmployeeListPage from '../pages/employees/EmployeeListPage';
import EmployeeDetailPage from '../pages/employees/EmployeeDetailPage';
import EmployeeEditPage from '../pages/employees/EmployeeEditPage';
import DepartmentPage from '../pages/departments/DepartmentPage';
import CertificateListPage from '../pages/certificates/CertificateListPage';
import CmeRecordListPage from '../pages/cme/CmeRecordListPage';
import DashboardPage from '../pages/DashboardPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/accounts" element={<AccountListPage />} />
            <Route path="/accounts/new" element={<AccountCreatePage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/accounts/:id/edit" element={<AccountEditPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['hr_manager']} />}>
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeEditPage />} />
            <Route path="/departments" element={<DepartmentPage />} />
            <Route path="/certificates" element={<CertificateListPage />} />
            <Route path="/cme-records" element={<CmeRecordListPage />} />
            <Route path="/organization" element={<Navigate to="/employees" replace />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
