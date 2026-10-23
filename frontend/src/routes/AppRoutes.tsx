import { Route, Routes } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';

export default function AppRoutes() {
  return <Routes>
    <Route element={<AppLayout />}><Route index element={<HomePage />} /></Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
