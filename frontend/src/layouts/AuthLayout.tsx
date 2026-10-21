import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';
export default function AuthLayout({title, description, children, back = true}: {title: string; description: string; children: ReactNode; back?: boolean}) {
 return <div className="vnc login-page">    <aside className="login-story">
      <div className="brand"><span className="brand-mark">✚</span><div>VNC <span>CLINIC</span><small>HUMAN RESOURCE MANAGEMENT</small></div></div>
      <div className="story-content"><span className="eyebrow light">CON NGƯỜI LÀ TRỌNG TÂM</span><h1>Kết nối đội ngũ.<br />Nâng tầm chăm sóc.</h1><p>Một không gian làm việc thống nhất để quản lý nhân sự và đồng hành cùng sự phát triển của phòng khám.</p>
        <div className="story-art" aria-hidden="true"><div className="orbit one" /><div className="orbit two" /><div className="art-cross">✚</div><div className="art-tag tag-one"><Icon name="users" /> Đội ngũ gắn kết</div><div className="art-tag tag-two"><Icon name="shield" /> Thông tin bảo mật</div><div className="art-dot" /></div>
      </div><div className="story-footer">VNC Clinic <span>Chăm sóc từ sự tận tâm</span></div>
    </aside>

 <main className="login-main"><div className="login-box">{back && <Link className="text-button auth-back" to="/login"><Icon name="arrow" size={16}/>Quay lại đăng nhập</Link>}
 <span className="eyebrow">CỔNG THÔNG TIN NHÂN SỰ</span><h2>{title}</h2><p className="muted">{description}</p>{children}</div>
 <footer className="login-footer">© {new Date().getFullYear()} VNC Clinic · Hệ thống quản lý nhân sự</footer></main></div>;
}
