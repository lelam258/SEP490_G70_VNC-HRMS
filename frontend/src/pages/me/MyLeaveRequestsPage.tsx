import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { leaveApi } from '../../services/leaveApi';
import type { LeaveRequestDetail, LeaveRequestSummary } from '../../types/leave';
import { formatDateOnly } from '../../utils/format';
import { formatVietnamDateTime } from '../../utils/leaveRules';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  withdrawn: 'Đã thu hồi',
};

const STATUS_BADGES: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
  withdrawn: 'badge-secondary',
};

export default function MyLeaveRequestsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [requests, setRequests] = useState<LeaveRequestSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>((location.state as { notice?: string })?.notice || '');

  // Detail Modal
  const [selectedDetail, setSelectedDetail] = useState<LeaveRequestDetail | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Withdraw Modal
  const [withdrawingRequest, setWithdrawingRequest] = useState<LeaveRequestSummary | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await leaveApi.listMyLeaveRequests(statusFilter);
      setRequests(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách đơn nghỉ phép.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const isFilterActive = Boolean(searchTerm.trim() || fromDate || toDate || statusFilter !== 'all');

  const handleResetFilters = () => {
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setStatusFilter('all');
  };

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return requests.filter((r) => {
      if (query) {
        const matchType = r.leaveTypeName?.toLowerCase().includes(query);
        const matchReason = r.reason?.toLowerCase().includes(query);
        const matchStatus = STATUS_LABELS[r.status]?.toLowerCase().includes(query);
        if (!matchType && !matchReason && !matchStatus) return false;
      }
      if (fromDate && r.endDate < fromDate) return false;
      if (toDate && r.startDate > toDate) return false;
      return true;
    });
  }, [requests, searchTerm, fromDate, toDate]);

  const handleOpenDetail = async (requestId: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const detail = await leaveApi.getLeaveRequestDetail(requestId);
      setSelectedDetail(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết đơn.');
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!withdrawingRequest) return;
    setIsWithdrawing(true);
    setWithdrawError('');
    try {
      await leaveApi.withdrawLeaveRequest(withdrawingRequest.requestId);
      setWithdrawingRequest(null);
      setNotice('Thu hồi đơn nghỉ phép thành công.');
      await loadRequests();
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : 'Không thể thu hồi đơn nghỉ phép.');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const columns: Column<LeaveRequestSummary>[] = [
    {
      key: 'leaveTypeName',
      label: 'Loại nghỉ',
      render: (r: LeaveRequestSummary) => <strong style={{ color: '#294656' }}>{r.leaveTypeName}</strong>,
    },
    {
      key: 'dates',
      label: 'Khoảng thời gian',
      render: (r: LeaveRequestSummary) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, color: '#294656' }}>
            {formatDateOnly(r.startDate)} — {formatDateOnly(r.endDate)}
          </span>
          <span
            className="badge badge-secondary"
            style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}
          >
            {r.totalDays} ngày làm việc
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Lý do',
      render: (r: LeaveRequestSummary) => (
        <span
          style={{
            maxWidth: '260px',
            display: 'inline-block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: r.reason ? '#526a7a' : '#94a2ac',
            fontStyle: r.reason ? 'normal' : 'italic',
          }}
          title={r.reason || ''}
        >
          {r.reason || 'Chưa cập nhật'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (r: LeaveRequestSummary) => (
        <span className={`badge ${STATUS_BADGES[r.status] || 'badge-secondary'}`}>
          {STATUS_LABELS[r.status] || r.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Ngày tạo (VN)',
      render: (r: LeaveRequestSummary) => (
        <span style={{ color: '#748793', fontSize: '12px' }}>
          {formatVietnamDateTime(r.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r: LeaveRequestSummary) => (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="button small secondary"
            onClick={() => handleOpenDetail(r.requestId)}
            title="Xem chi tiết"
          >
            <Icon name="eye" size={14} /> Chi tiết
          </button>
          {r.status === 'pending' && (
            <button
              type="button"
              className="button small danger"
              onClick={() => {
                setWithdrawingRequest(r);
                setWithdrawError('');
              }}
              title="Thu hồi đơn"
            >
              <Icon name="close" size={14} /> Thu hồi
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Đơn nghỉ phép của tôi</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted, #6b7280)' }}>
              Theo dõi và quản lý các đơn xin nghỉ phép đã nộp
            </p>
          </div>

          <button
            type="button"
            className="button primary"
            onClick={() => navigate('/me/leave-requests/new')}
          >
            <Icon name="plus" /> Tạo đơn nghỉ phép
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="leave-filter-container">
          <div className="leave-filter-item leave-filter-search">
            <label htmlFor="leave-search-input">Tìm kiếm</label>
            <div className="input-icon" style={{ minHeight: '39px', background: 'white' }}>
              <Icon name="search" size={16} />
              <input
                id="leave-search-input"
                type="text"
                placeholder="Tìm loại nghỉ, lý do..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '12px' }}
              />
              {isFilterActive && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleResetFilters}
                  title="Xóa tìm kiếm & đặt lại bộ lọc"
                  style={{ width: '28px', height: '28px', padding: '4px' }}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="leave-filter-item leave-filter-status">
            <label htmlFor="leave-status-select">Trạng thái</label>
            <select
              id="leave-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minHeight: '39px', fontSize: '12px' }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
              <option value="withdrawn">Đã thu hồi</option>
            </select>
          </div>

          <div className="leave-filter-item leave-filter-date">
            <label htmlFor="leave-from-date">Từ ngày</label>
            <input
              id="leave-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ minHeight: '39px', fontSize: '12px' }}
            />
          </div>

          <div className="leave-filter-item leave-filter-date">
            <label htmlFor="leave-to-date">Đến ngày</label>
            <input
              id="leave-to-date"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              style={{ minHeight: '39px', fontSize: '12px' }}
            />
          </div>
        </div>

        {/* Result summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', fontSize: '12px', color: '#748793' }}>
          <span>
            {isFilterActive
              ? `Tìm thấy ${filteredRequests.length} đơn nghỉ phép (trên tổng số ${requests.length})`
              : `Tổng cộng ${requests.length} đơn nghỉ phép`}
          </span>
          {isFilterActive && (
            <button
              type="button"
              className="text-button"
              onClick={handleResetFilters}
              style={{ fontSize: '12px' }}
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ color: '#8a9ca7', margin: 0 }}>Đang tải danh sách đơn nghỉ phép...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state" style={{ padding: '56px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#edf5f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#398980', marginBottom: '16px' }}>
              <Icon name={isFilterActive ? 'search' : 'calendar'} size={26} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#294656', margin: '0 0 6px' }}>
              {isFilterActive ? 'Không tìm thấy đơn nghỉ phép phù hợp' : 'Chưa có đơn nghỉ phép nào'}
            </h3>
            <p style={{ fontSize: '13px', color: '#8a9ca7', margin: '0 0 18px', maxWidth: '420px', lineHeight: 1.5 }}>
              {isFilterActive
                ? 'Không có đơn nào khớp với từ khóa tìm kiếm hoặc khoảng thời gian bạn đã chọn.'
                : 'Bạn chưa gửi đơn xin nghỉ phép nào. Hãy tạo đơn mới khi có nhu cầu xin nghỉ phép.'}
            </p>
            {isFilterActive ? (
              <button type="button" className="button small secondary" onClick={handleResetFilters}>
                <Icon name="close" size={14} /> Xóa bộ lọc
              </button>
            ) : (
              <button type="button" className="button primary" onClick={() => navigate('/me/leave-requests/new')}>
                <Icon name="plus" size={16} /> Tạo đơn nghỉ phép đầu tiên
              </button>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredRequests}
            rowKey={(r) => r.requestId}
            emptyMessage=""
          />
        )}
      </div>

      {/* Detail Modal */}
      {detailModalOpen && (
        <Modal
          title="Chi tiết đơn nghỉ phép"
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedDetail(null);
          }}
        >
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {loadingDetail || !selectedDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', gap: '0.75rem' }}>
                <span className="vnc-spinner" style={{ width: '28px', height: '28px', borderColor: 'rgba(8, 127, 122, 0.25)', borderTopColor: '#087f7a' }} />
                <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Đang tải thông tin chi tiết...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {/* Highlight Card */}
                <div style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 650, color: '#0f172a' }}>
                      {selectedDetail.leaveTypeName}
                    </span>
                    <span className={`badge ${STATUS_BADGES[selectedDetail.status] || 'badge-secondary'}`} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {STATUS_LABELS[selectedDetail.status] || selectedDetail.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '0.625rem', borderTop: '1px solid #edf2f7' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '2px' }}>
                        Khoảng thời gian
                      </span>
                      <strong style={{ fontSize: '0.925rem', color: '#1e293b' }}>
                        {formatDateOnly(selectedDetail.startDate)} — {formatDateOnly(selectedDetail.endDate)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '2px' }}>
                        Tổng số ngày nghỉ
                      </span>
                      <strong style={{ fontSize: '0.925rem', color: '#087f7a' }}>
                        {selectedDetail.totalDays} ngày làm việc
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Ngày gửi đơn (VN):</span>
                    <span style={{ color: '#1e293b', fontWeight: 500 }}>{formatVietnamDateTime(selectedDetail.createdAt)}</span>
                  </div>

                  {selectedDetail.attachmentUrl && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#64748b' }}>Tệp đính kèm:</span>
                      <a
                        href={selectedDetail.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#2563eb',
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          textDecoration: 'none'
                        }}
                      >
                        <Icon name="file" /> Xem tệp đính kèm ↗
                      </a>
                    </div>
                  )}

                  {/* Reason Box */}
                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{ display: 'block', color: '#64748b', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                      Lý do xin nghỉ:
                    </span>
                    <div style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderLeft: '3px solid #087f7a',
                      borderRadius: '6px',
                      color: '#334155',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {selectedDetail.reason || '—'}
                    </div>
                  </div>

                  {/* Approver info if approved */}
                  {selectedDetail.approvedByName && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Người duyệt:</span>
                        <strong style={{ color: '#14532d' }}>{selectedDetail.approvedByName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: '#166534' }}>Thời gian duyệt:</span>
                        <span style={{ color: '#166534' }}>{formatVietnamDateTime(selectedDetail.approvedAt)}</span>
                      </div>
                    </div>
                  )}

                  {/* Reject info if rejected */}
                  {selectedDetail.rejectedReason && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px'
                    }}>
                      <span style={{ color: '#b91c1c', display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Lý do từ chối:
                      </span>
                      <p style={{ margin: 0, color: '#991b1b', fontSize: '0.875rem', lineHeight: 1.45 }}>
                        {selectedDetail.rejectedReason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #f1f5f9',
                  marginTop: '0.25rem'
                }}>
                  {selectedDetail.status === 'pending' && (
                    <button
                      type="button"
                      className="button secondary small"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                      onClick={() => {
                        const summary = requests.find((r) => r.requestId === selectedDetail.requestId);
                        if (summary) {
                          setDetailModalOpen(false);
                          setSelectedDetail(null);
                          setWithdrawingRequest(summary);
                        }
                      }}
                    >
                      Thu hồi đơn này
                    </button>
                  )}
                  <button
                    type="button"
                    className="button primary small"
                    onClick={() => {
                      setDetailModalOpen(false);
                      setSelectedDetail(null);
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Withdraw Confirmation Modal */}
      {withdrawingRequest && (
        <Modal
          title="Xác nhận thu hồi đơn nghỉ phép"
          onClose={() => setWithdrawingRequest(null)}
          busy={isWithdrawing}
        >
          <div style={{ padding: '1.25rem 1.5rem' }}>
            {withdrawError && <Alert variant="error">{withdrawError}</Alert>}
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '1rem',
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '8px',
              marginBottom: '1.25rem'
            }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e', lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn thu hồi đơn nghỉ phép{' '}
                <strong>{withdrawingRequest.leaveTypeName}</strong> (
                {formatDateOnly(withdrawingRequest.startDate)} — {formatDateOnly(withdrawingRequest.endDate)}) không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setWithdrawingRequest(null)}
                disabled={isWithdrawing}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="button danger"
                onClick={handleConfirmWithdraw}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? 'Đang thu hồi...' : 'Xác nhận thu hồi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
