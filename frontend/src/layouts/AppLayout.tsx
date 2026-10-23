import { Link, Outlet } from 'react-router-dom';

export default function AppLayout() {
  return <div className="vnc min-h-screen">
    <header className="border-b border-slate-200 bg-white px-8 py-5">
      <Link className="text-lg font-bold text-teal-700" to="/">VNC HRMS</Link>
    </header>
    <main className="mx-auto max-w-6xl p-8"><Outlet /></main>
  </div>;
}
