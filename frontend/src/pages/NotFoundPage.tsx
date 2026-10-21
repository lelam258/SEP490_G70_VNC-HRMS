import { Link } from 'react-router-dom';
export default function NotFoundPage() { return <main className="vnc grid min-h-screen place-content-center gap-5 p-8 text-center"><h1 className="text-3xl font-bold">Không tìm thấy trang</h1><Link className="button primary" to="/">Về trang chủ</Link></main>; }
