import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon';

export default function AuthLayout({
  title,
  description,
  children,
  back = true,
}: {
  title: string;
  description: string;
  children: ReactNode;
  back?: boolean;
}) {
  return (
    <div className="vnc login-layout-root">
      {/* LEFT COLUMN: Auth Form Box */}
      <main className="login-panel-left">
        <div className="auth-card-inner">
          {/* Top Brand Logo */}
          <div className="auth-brand-header">
            <div className="auth-brand-logo-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className="auth-brand-text-block">
              <span className="auth-brand-title">VNC CLINIC</span>
              <span className="auth-brand-subtitle">HUMAN RESOURCE MANAGEMENT</span>
            </div>
          </div>

          {/* Back button if forgot/reset password */}
          {back && (
            <Link className="auth-back-link" to="/login">
              <Icon name="arrow" size={16} />
              <span>Quay lại đăng nhập</span>
            </Link>
          )}

          {/* Pill Badge */}
          <div className="auth-pill-badge">
            <span className="auth-pill-indicator" />
            <span>CỔNG THÔNG TIN NHÂN SỰ</span>
          </div>

          {/* Title & Description */}
          <h1 className="auth-heading">{title}</h1>
          <p className="auth-subheading">{description}</p>

          {/* Form Content */}
          <div className="auth-form-wrapper">
            {children}
          </div>

          {/* Bottom Copyright */}
          <div className="auth-footer-copyright">
            © {new Date().getFullYear()} VNC Clinic · Hệ thống quản lý nhân sự · Bảo mật và chuẩn mực hành nghề y khoa.
          </div>
        </div>
      </main>

      {/* RIGHT COLUMN: Hero Story & Real VNC-HRMS Mockup Showcase (Overflowing corner device) */}
      <aside className="login-panel-right">
        <div className="hero-content-wrapper">
          {/* Top Pill */}
          <div className="hero-pill-badge">
            <span className="hero-pill-dot" />
            <span>CON NGƯỜI LÀ TRỌNG TÂM</span>
          </div>

          {/* Hero Titles */}
          <h2 className="hero-headline">
            Kết nối đội ngũ. Nâng tầm chăm sóc.
          </h2>
          <p className="hero-description">
            Một không gian làm việc thống nhất để quản lý nhân sự và đồng hành cùng sự phát triển của phòng khám.
          </p>

          {/* 4 Feature Badges */}
          <div className="hero-feature-pills">
            <span className="hero-feature-item">
              <span className="feature-dot" /> VNC Clinic
            </span>
            <span className="hero-feature-item">
              <span className="feature-dot" /> Chăm sóc từ sự tận tâm
            </span>
            <span className="hero-feature-item">
              <span className="feature-dot" /> Đội ngũ gắn kết
            </span>
            <span className="hero-feature-item">
              <span className="feature-dot" /> Thông tin bảo mật
            </span>
          </div>
        </div>

        {/* Real VNC-HRMS Application Mockup Window (Positioned to bleed off bottom-right edge) */}
        <div className="hrms-mockup-window" aria-hidden="true">
          <div className="mockup-layout-grid">
            {/* Left Sidebar matching AppLayout.tsx core HR & Clinic modules */}
            <div className="mockup-real-sidebar">
              <div className="mockup-sidebar-brand">
                <span className="brand-cross">✚</span>
                <div className="brand-text">
                  <strong>VNC <span>CLINIC</span></strong>
                  <small>QUẢN LÝ NHÂN SỰ</small>
                </div>
              </div>

              <div className="mockup-workspace-label">KHÔNG GIAN LÀM VIỆC</div>
              <div className="mockup-nav-list">
                <div className="mockup-nav-row selected">
                  <Icon name="building" size={13} />
                  <span>Trang chủ</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="users" size={13} />
                  <span>Lịch làm việc</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="calendar" size={13} />
                  <span>Chấm công &amp; ca trực</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="users" size={13} />
                  <span>Nhân viên</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="building" size={13} />
                  <span>Khoa/phòng</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="fileText" size={13} />
                  <span>Hợp đồng lao động</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="shield" size={13} />
                  <span>Compliance</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="award" size={13} />
                  <span>Bằng cấp &amp; Chứng chỉ</span>
                </div>
                <div className="mockup-nav-row">
                  <Icon name="clock" size={13} />
                  <span>Duyệt nghỉ phép</span>
                </div>
              </div>
            </div>

            {/* Right Workspace Column matching AppLayout.tsx + DashboardPage.tsx */}
            <div className="mockup-workspace-main">
              {/* Topbar */}
              <div className="mockup-topbar">
                <div className="mockup-topbar-left">
                  <span className="mockup-menu-btn">☰</span>
                  <div className="mockup-breadcrumb">
                    <span>Không gian làm việc</span>
                    <span className="sep">/</span>
                    <strong>Trang chủ</strong>
                  </div>
                </div>
                <div className="mockup-topbar-right">
                  <span className="mockup-bell-btn">
                    <Icon name="bell" size={12} />
                    <span className="mockup-bell-badge">3</span>
                  </span>
                  <div className="mockup-user-chip">
                    <span className="mockup-avatar-badge">HR</span>
                    <div className="mockup-user-meta">
                      <strong>Phòng Nhân sự</strong>
                      <small>Trưởng phòng Nhân sự</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content matching DashboardPage.tsx */}
              <div className="mockup-main-area">
                {/* 1. Welcome Banner */}
                <div className="mockup-welcome-banner">
                  <div className="banner-left">
                    <div className="banner-avatar">VN</div>
                    <div>
                      <div className="banner-title-flex">
                        <h4>Xin chào, Phòng Nhân sự VNC 👋</h4>
                        <span className="banner-online-tag">
                          <span className="banner-online-dot" />
                          Trực tuyến
                        </span>
                      </div>
                      <p className="banner-sub">
                        Thứ Hai, 16 Tháng 11, 2026 · Quản trị Nhân sự, Lịch trực &amp; Đãi ngộ Y tế
                      </p>
                    </div>
                  </div>
                  <span className="mockup-banner-btn">Hồ sơ nhân viên →</span>
                </div>

                {/* 2. 3 KPI Cards from DashboardPage.tsx */}
                <div className="mockup-kpi-row">
                  <div className="mockup-kpi-card">
                    <div className="mockup-kpi-head">
                      <span>HỢP ĐỒNG NHÂN SỰ</span>
                      <span className="kpi-icon-box sky">
                        <Icon name="fileText" size={11} />
                      </span>
                    </div>
                    <div className="mockup-kpi-val">
                      <strong>25</strong>
                      <span>nhân sự</span>
                    </div>
                    <div className="mockup-kpi-sub emerald">● 100% đang có hiệu lực</div>
                  </div>

                  <div className="mockup-kpi-card">
                    <div className="mockup-kpi-head">
                      <span>QUỸ LƯƠNG THÁNG GẦN NHẤT</span>
                      <span className="kpi-icon-box emerald">
                        <Icon name="calendar" size={11} />
                      </span>
                    </div>
                    <div className="mockup-kpi-val">
                      <strong className="money">349.415.000 ₫</strong>
                    </div>
                    <div className="mockup-kpi-sub muted">Kỳ Tháng 02/2026 · Đã duyệt</div>
                  </div>

                  <div className="mockup-kpi-card">
                    <div className="mockup-kpi-head">
                      <span>QUY TẮC &amp; THAM SỐ</span>
                      <span className="kpi-icon-box indigo">
                        <Icon name="sliders" size={11} />
                      </span>
                    </div>
                    <div className="mockup-kpi-val">
                      <strong>37</strong>
                      <span>quy tắc</span>
                    </div>
                    <div className="mockup-kpi-sub muted">Phụ cấp, BHXH, Thuế, Hoa hồng</div>
                  </div>
                </div>

                {/* 3. Dashboard Two-Column Body */}
                <div className="mockup-dashboard-grid">
                  {/* Left Column */}
                  <div className="mockup-dash-left">
                    {/* Panel 1: Kỳ tính lương gần đây (Populated table) */}
                    <div className="mockup-panel">
                      <div className="mockup-panel-header">
                        <strong>Kỳ tính lương gần đây</strong>
                        <span className="mockup-panel-link">Tất cả kỳ lương →</span>
                      </div>
                      <table className="mockup-period-table">
                        <thead>
                          <tr>
                            <th>KỲ TÍNH LƯƠNG</th>
                            <th className="center">NHÂN SỰ</th>
                            <th className="right">TỔNG THỰC LĨNH</th>
                            <th className="center">TRẠNG THÁI</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>Tháng 02/2026</strong></td>
                            <td className="center">25 người</td>
                            <td className="right money">349.415.000 ₫</td>
                            <td className="center"><span className="period-badge badge-emerald">Đã duyệt</span></td>
                          </tr>
                          <tr>
                            <td><strong>Tháng 01/2026</strong></td>
                            <td className="center">25 người</td>
                            <td className="right money">342.180.000 ₫</td>
                            <td className="center"><span className="period-badge badge-rose">Đã khóa</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Panel 2: Phân bổ nhân sự theo Cơ sở Y tế */}
                    <div className="mockup-panel mockup-sites-panel">
                      <div className="mockup-section-title">
                        <Icon name="building" size={11} />
                        <span>Phân bổ nhân sự theo Cơ sở Y tế</span>
                      </div>
                      <div className="mockup-sites-grid">
                        <div className="mockup-site-card">
                          <div className="site-info">
                            <strong>Cơ sở 1 - Phòng khám Đa khoa Quốc tế</strong>
                            <small>Bác sĩ, Điều dưỡng, Chẩn đoán hình ảnh</small>
                          </div>
                          <div className="site-count">
                            <strong>15</strong>
                            <small>nhân sự</small>
                          </div>
                        </div>
                        <div className="mockup-site-card">
                          <div className="site-info">
                            <strong>Cơ sở 2 - Trung tâm Kỹ thuật cao</strong>
                            <small>Xét nghiệm, Dược, Kế toán &amp; Hành chính</small>
                          </div>
                          <div className="site-count">
                            <strong>10</strong>
                            <small>nhân sự</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Lối tắt nghiệp vụ */}
                  <div className="mockup-dash-right">
                    <div className="mockup-panel mockup-shortcuts-panel">
                      <div className="mockup-section-title">
                        <Icon name="sliders" size={11} />
                        <span>Lối tắt nghiệp vụ</span>
                      </div>
                      <div className="mockup-shortcut-list">
                        <div className="mockup-shortcut-item">
                          <span className="shortcut-icon sky">
                            <Icon name="users" size={11} />
                          </span>
                          <div className="shortcut-text">
                            <strong>Hồ sơ nhân viên</strong>
                            <small>Danh sách cán bộ y tế</small>
                          </div>
                          <span className="shortcut-arrow">→</span>
                        </div>
                        <div className="mockup-shortcut-item">
                          <span className="shortcut-icon teal">
                            <Icon name="building" size={11} />
                          </span>
                          <div className="shortcut-text">
                            <strong>Khoa / Phòng</strong>
                            <small>Cơ cấu tổ chức phòng khám</small>
                          </div>
                          <span className="shortcut-arrow">→</span>
                        </div>
                        <div className="mockup-shortcut-item">
                          <span className="shortcut-icon emerald">
                            <Icon name="shield" size={11} />
                          </span>
                          <div className="shortcut-text">
                            <strong>Compliance Dashboard</strong>
                            <small>Giám sát tuân thủ &amp; chứng chỉ</small>
                          </div>
                          <span className="shortcut-arrow">→</span>
                        </div>
                        <div className="mockup-shortcut-item">
                          <span className="shortcut-icon indigo">
                            <Icon name="award" size={11} />
                          </span>
                          <div className="shortcut-text">
                            <strong>Bằng cấp &amp; Chứng chỉ</strong>
                            <small>Hồ sơ năng lực y tế</small>
                          </div>
                          <span className="shortcut-arrow">→</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
