import { Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/auth/LoginPage';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import NotFoundPage from '../pages/NotFoundPage';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
