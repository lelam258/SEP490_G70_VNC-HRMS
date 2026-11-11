import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import LoginPage from '../pages/auth/LoginPage';
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
import ContractListPage from '../pages/contracts/ContractListPage';
import ContractCreatePage from '../pages/contracts/ContractCreatePage';
import ContractDetailPage from '../pages/contracts/ContractDetailPage';
import ContractEditPage from '../pages/contracts/ContractEditPage';
import CertificateListPage from '../pages/certificates/CertificateListPage';
import CmeRecordListPage from '../pages/cme/CmeRecordListPage';
import ComplianceDashboardPage from '../pages/compliance/ComplianceDashboardPage';
import DashboardPage from '../pages/DashboardPage';
import NotFoundPage from '../pages/NotFoundPage';
import PayrollParameterPage from '../pages/payroll/PayrollParameterPage';
import CompensationPage from '../pages/payroll/CompensationPage';
import PayrollPeriodsPage from '../pages/payroll/PayrollPeriodsPage';
import PayrollPeriodDetailPage from '../pages/payroll/PayrollPeriodDetailPage';
import ProcedureListPage from '../pages/payroll/ProcedureListPage';
import ProcedureDetailPage from '../pages/payroll/ProcedureDetailPage';
import ProcedureFormPage from '../pages/payroll/ProcedureFormPage';
import ProcedureServiceListPage from '../pages/payroll/ProcedureServiceListPage';
import ProcedureServiceDetailPage from '../pages/payroll/ProcedureServiceDetailPage';
import CommissionResultsPage from '../pages/payroll/CommissionResultsPage';
import ProfilePage from '../pages/me/ProfilePage';
import MyCertificateListPage from '../pages/me/MyCertificateListPage';
import MyCmeListPage from '../pages/me/MyCmeListPage';
import MyLeaveRequestsPage from '../pages/me/MyLeaveRequestsPage';
import LeaveRequestFormPage from '../pages/me/LeaveRequestFormPage';
import ProtectedRoute from './ProtectedRoute';
import SchedulesPage from '../pages/SchedulesPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/accounts" element={<AccountListPage />} />
            <Route path="/accounts/new" element={<AccountCreatePage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/accounts/:id/edit" element={<AccountEditPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['hr_manager', 'department_head', 'admin']} />}>
            <Route path="/compliance" element={<ComplianceDashboardPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['hr_manager']} />}>
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/employees/:id/edit" element={<EmployeeEditPage />} />
            <Route path="/departments" element={<DepartmentPage />} />
            <Route path="/contracts" element={<ContractListPage />} />
            <Route path="/contracts/new" element={<ContractCreatePage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/contracts/:id/edit" element={<ContractEditPage />} />
            <Route path="/certificates" element={<CertificateListPage />} />
            <Route path="/cme-records" element={<CmeRecordListPage />} />
            <Route path="/organization" element={<Navigate to="/employees" replace />} />
          </Route>
          <Route element={<ProtectedRoute roles={['hr_manager', 'hr_staff', 'accountant', 'department_head', 'employee']} />}>
            <Route path="/procedures" element={<ProcedureListPage />} />
            <Route path="/procedures/:id" element={<ProcedureDetailPage />} />
            <Route path="/me/profile" element={<ProfilePage />} />
            <Route path="/me/certificates" element={<MyCertificateListPage />} />
            <Route path="/me/cme-records" element={<MyCmeListPage />} />
            <Route path="/me/leave-requests" element={<MyLeaveRequestsPage />} />
            <Route path="/me/leave-requests/new" element={<LeaveRequestFormPage />} />
            <Route path="/me/leave-requests/:id/edit" element={<LeaveRequestFormPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['hr_manager', 'department_head', 'employee']} />}>
            <Route path="/procedures/new" element={<ProcedureFormPage />} />
            <Route path="/procedures/:id/edit" element={<ProcedureFormPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['accountant', 'department_head']} />}>
            <Route path="/payroll/commission-results" element={<CommissionResultsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['accountant']} />}>
            <Route path="/payroll/parameters" element={<PayrollParameterPage />} />
            <Route path="/payroll/compensation" element={<CompensationPage />} />
            <Route path="/payroll/periods" element={<PayrollPeriodsPage />} />
            <Route path="/payroll/periods/:month" element={<PayrollPeriodDetailPage />} />
            <Route path="/payroll/procedure-services" element={<ProcedureServiceListPage />} />
            <Route path="/payroll/procedure-services/:id" element={<ProcedureServiceDetailPage />} />
            <Route path="/payroll/procedures" element={<ProcedureListPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
