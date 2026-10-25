import { Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import AccountListPage from '../pages/accounts/AccountListPage';
import AccountCreatePage from '../pages/accounts/AccountCreatePage';
import AccountDetailPage from '../pages/accounts/AccountDetailPage';
import AccountEditPage from '../pages/accounts/AccountEditPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/accounts" element={<AccountListPage />} />
          <Route path="/accounts/new" element={<AccountCreatePage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/accounts/:id/edit" element={<AccountEditPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
