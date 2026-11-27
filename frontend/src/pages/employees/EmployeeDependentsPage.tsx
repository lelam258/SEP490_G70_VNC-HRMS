import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { dependentApi } from '../../services/dependentApi';
import { employeeApi } from '../../services/employeeApi';
import { fileApi } from '../../services/fileApi';
import { useAppStore } from '../../store/useAppStore';
import type { EmployeeDetail } from '../../types/accounts';
import {
  DEPENDENT_DOCUMENT_TYPE_OPTIONS,
  getDocumentTypeLabel,
  getGenderLabel,
  getRelationshipLabel,
  getVerificationStatusLabel,
  type EmployeeDependent,
} from '../../types/dependents';
import { validateDependentDocumentUrl } from '../../utils/dependentRules';
import { formatDate, initials } from '../../utils/format';

const PAGE_SIZE = 3;
type CardTab = 'info' | 'documents' | 'inactive_documents';
type DocSourceMode = 'upload' | 'url' | 'none';
type SortOrder = 'newest' | 'oldest';

export default function EmployeeDependentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [dependents, setDependents] = useState<EmployeeDependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Active tab per dependent card ('info' | 'documents' | 'inactive_documents')
  const [activeTabs, setActiveTabs] = useState<Record<string, CardTab>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Add document modal state
  const [docTarget, setDocTarget] = useState<EmployeeDependent | null>(null);
  const [docType, setDocType] = useState('birth_certificate');
  const [docFileName, setDocFileName] = useState('');
  const [docSourceMode, setDocSourceMode] = useState<DocSourceMode>('upload');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [uploadedFileLabel, setUploadedFileLabel] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const docUrlError = docSourceMode === 'url' ? validateDependentDocumentUrl(docFileUrl) : '';

  async function loadData() {
    if (!id) return;
    setLoading(true);
    setPageError('');
    try {
      const [empData, depData] = await Promise.all([
        employeeApi.get(id),
        dependentApi.list(id),
      ]);
      setEmployee(empData);
      setDependents(depData);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Không tải được danh sách người phụ thuộc.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [id]);

  const sortedDependents = [...dependents].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const totalPages = Math.max(1, Math.ceil(sortedDependents.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = sortedDependents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeCount = dependents.filter(d => d.isActive).length;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function getTab(staffDependentId: string): CardTab {
    return activeTabs[staffDependentId] ?? 'info';
  }

  function setTab(staffDependentId: string, tab: CardTab) {
    setActiveTabs(prev => ({ ...prev, [staffDependentId]: tab }));
  }

  async function handleToggleActive(item: EmployeeDependent) {
    if (!id || busyId) return;
    setBusyId(item.staffDependentId);
    try {
      await dependentApi.update(id, item.staffDependentId, {
        fullName: item.fullName,
        dateOfBirth: item.dateOfBirth,
        gender: item.gender,
        idCardNumber: item.idCardNumber,
        taxCode: item.taxCode,
        relationship: item.relationship,
        isActive: !item.isActive,
      });
      useAppStore
        .getState()
        .setNotice(!item.isActive ? 'Đã kích hoạt lại quản lý người phụ thuộc.' : 'Đã chuyển người phụ thuộc sang ngừng quản lý.');
      await loadData();
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái quản lý.');
    } finally {
      setBusyId(null);
    }
  }

  function openAddDocumentModal(item: EmployeeDependent) {
    setDocTarget(item);
    setDocType('birth_certificate');
    setDocFileName('');
    setDocSourceMode('upload');
    setDocFileUrl('');
    setUploadedFileLabel('');
    setDocError('');
  }

  function handleChangeDocSourceMode(mode: DocSourceMode) {
    setDocSourceMode(mode);
    setDocFileUrl('');
    setUploadedFileLabel('');
    setDocError('');
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setDocError('');
    try {
      const uploaded = await fileApi.upload(file);
      if (!docFileName.trim()) setDocFileName(file.name);
      setUploadedFileLabel(file.name);
      setDocFileUrl(uploaded.url);
    } catch (cause) {
      setDocError(cause instanceof Error ? cause.message : 'Không thể tải tệp lên.');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  }

  async function handleSubmitDocument(e: FormEvent) {
    e.preventDefault();
    if (!id || !docTarget || savingDoc) return;

    setDocError('');
    if (!docFileName.trim()) {
      setDocError('Tên tài liệu minh chứng là bắt buộc.');
      return;
    }
    if (docSourceMode === 'upload' && !docFileUrl) {
      setDocError('Vui lòng chọn tệp để tải lên hoặc chuyển sang mục "Bản cứng (để trống)".');
      return;
    }
    if (docSourceMode === 'url') {
      if (!docFileUrl.trim()) {
        setDocError('Vui lòng nhập đường dẫn tệp hoặc chuyển sang mục "Bản cứng (để trống)".');
        return;
      }
      if (docUrlError) {
        setDocError(docUrlError);
        return;
      }
    }

    setSavingDoc(true);
    try {
      const targetId = docTarget.staffDependentId;
      await dependentApi.addDocument(id, targetId, {
        documentType: docType,
        fileName: docFileName.trim(),
        fileUrl: docSourceMode === 'none' ? null : (docFileUrl || null),
      });
      useAppStore.getState().setNotice('Đã thêm hồ sơ minh chứng.');
      setDocTarget(null);
      setTab(targetId, 'documents');
      await loadData();
    } catch (cause) {
      setDocError(cause instanceof Error ? cause.message : 'Không thể thêm hồ sơ minh chứng.');
    } finally {
      setSavingDoc(false);
    }
  }

  async function handleVerifyDocument(staffDependentId: string, documentId: string, status: 'verified' | 'expired') {
    if (!id || busyId) return;
    setBusyId(documentId);
    try {
      await dependentApi.verifyDocument(id, staffDependentId, documentId, status);
      useAppStore
        .getState()
        .setNotice(
          status === 'verified'
            ? 'Đã xác nhận hồ sơ minh chứng.'
            : 'Đã chuyển hồ sơ minh chứng sang mục Ngừng hoạt động (mất hiệu lực).',
        );
      await loadData();
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái kiểm tra.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectAndDeleteDocument(staffDependentId: string, documentId: string, isReject: boolean) {
    if (!id || busyId) return;
    const msg = isReject
      ? 'Từ chối hồ sơ minh chứng này sẽ xóa vĩnh viễn khỏi hệ thống. Bạn có chắc chắn?'
      : 'Bạn có chắc muốn xóa vĩnh viễn hồ sơ minh chứng này?';
    if (!window.confirm(msg)) return;

    setBusyId(documentId);
    try {
      await dependentApi.deleteDocument(id, staffDependentId, documentId);
      useAppStore
        .getState()
        .setNotice(isReject ? 'Đã từ chối và xóa hồ sơ minh chứng.' : 'Đã xóa hồ sơ minh chứng.');
      await loadData();
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Không thể xóa hồ sơ minh chứng.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="loading-state" role="status">Đang tải danh sách người phụ thuộc…</p>;
  }

  if (pageError && !employee) {
    return (
      <div className="account-form-page">
        <Alert variant="error">
          {pageError}
          <div style={{ marginTop: 12 }}>
            <button className="button" onClick={() => navigate(`/employees/${id}`)}>
              Quay lại hồ sơ nhân viên
            </button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <section
      className="account-form-page workspace-content-page"
      style={{
        paddingTop: 8,
        paddingBottom: 10,
        height: 'calc(100vh - 64px)',
        minHeight: 580,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Compact Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexShrink: 0 }}>
        <div>
          <button
            className="text-button back-button"
            type="button"
            style={{ marginBottom: 2, fontSize: 12.5 }}
            onClick={() => navigate(`/employees/${id}`)}
          >
            <Icon name="arrow" size={15} /> Quay lại hồ sơ nhân viên
          </button>
          <h1 style={{ margin: 0, fontSize: 20, lineHeight: 1.2 }}>Quản lý người phụ thuộc</h1>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => navigate(`/employees/${id}/dependents/new`)}
        >
          <Icon name="plus" size={16} /> Thêm người phụ thuộc
        </button>
      </div>

      {pageError && (
        <div style={{ marginBottom: 8, flexShrink: 0 }}>
          <Alert variant="error">{pageError}</Alert>
        </div>
      )}

      {/* Compact Single-Row Employee Summary */}
      {employee && (
        <div
          className="panel"
          style={{
            padding: '8px 14px',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span className="avatar" style={{ width: 34, height: 34, fontSize: 13, flexShrink: 0 }}>
              {initials(employee.name)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14.5 }}>{employee.name}</strong>
                <span className={`status-badge ${employee.status}`}>
                  <i />
                  {employee.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>
                Mã NV: <strong>{employee.code}</strong> · Khoa/phòng: <strong>{employee.department || 'Chưa phân khoa'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Đang quản lý (tính thuế TNCN)</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f766e', lineHeight: 1.2 }}>{activeCount} người</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dependents List Panel (3 items per page, 2/8 split) */}
      <div
        className="panel"
        style={{
          padding: '12px 14px',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 8,
              flexShrink: 0,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 15 }}>
              Danh sách người phụ thuộc ({dependents.length})
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {dependents.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label htmlFor="dep-sort" style={{ margin: 0, fontSize: 12.5, color: '#64748b', fontWeight: 500 }}>
                    Sắp xếp:
                  </label>
                  <select
                    id="dep-sort"
                    value={sortOrder}
                    onChange={e => {
                      setSortOrder(e.target.value as SortOrder);
                      setCurrentPage(1);
                    }}
                    style={{
                      width: 'auto',
                      padding: '4px 10px',
                      fontSize: 12.5,
                      height: 30,
                      borderRadius: 6,
                    }}
                  >
                    <option value="newest">Tạo sớm nhất → Lâu nhất</option>
                    <option value="oldest">Tạo lâu nhất → Sớm nhất</option>
                  </select>
                </div>
              )}
              {dependents.length > 0 && (
                <span style={{ fontSize: 12.5, color: '#64748b' }}>
                  Trang {safePage} / {totalPages}
                </span>
              )}
            </div>
          </div>

          {dependents.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: '0 0 12px' }}>Nhân viên này chưa có người phụ thuộc nào được đăng ký.</p>
              <button
                type="button"
                className="button primary"
                onClick={() => navigate(`/employees/${id}/dependents/new`)}
              >
                <Icon name="plus" size={16} /> Thêm người phụ thuộc đầu tiên
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
                gap: 10,
                flex: 1,
                minHeight: 0,
              }}
            >
              {pageItems.map(item => {
                const tab = getTab(item.staffDependentId);
                const activeDocs = item.documents.filter(d => d.verificationStatus !== 'expired');
                const expiredDocs = item.documents.filter(d => d.verificationStatus === 'expired');
                return (
                  <div
                    key={item.staffDependentId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 8fr',
                      border: '1px solid #dce8e5',
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: item.isActive ? '#ffffff' : '#f8fafc',
                      height: '100%',
                      minHeight: 0,
                    }}
                  >
                  {/* Phần 2 (20%): Tên người phụ thuộc, ngày sinh, giới tính */}
                  <div
                    style={{
                      padding: '10px 12px',
                      background: item.isActive ? '#f4faf8' : '#f1f5f9',
                      borderRight: '1px solid #dce8e5',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 6,
                      minHeight: 0,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a', lineHeight: 1.25 }}>
                        {item.fullName}
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                        <span
                          className="status-badge active"
                          style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 11, padding: '1px 7px' }}
                        >
                          {getRelationshipLabel(item.relationship)}
                        </span>
                        <span
                          className={`status-badge ${item.isActive ? 'active' : 'inactive'}`}
                          style={{ fontSize: 11, padding: '1px 7px' }}
                        >
                          <i />
                          {item.isActive ? 'Đang quản lý' : 'Ngừng quản lý'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: '#334155', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Ngày sinh:</span>{' '}
                        <strong>{formatDate(item.dateOfBirth)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Giới tính:</span>{' '}
                        <strong>{getGenderLabel(item.gender)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Phần 8 (80%): 3 Tabs (Thông tin | Hồ sơ | Ngừng hoạt động) + Actions */}
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                    {/* Tab bar + Action buttons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        borderBottom: '1px solid #e2e8f0',
                        paddingBottom: 6,
                        marginBottom: 6,
                        flexWrap: 'wrap',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setTab(item.staffDependentId, 'info')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: tab === 'info' ? '1px solid #0f766e' : '1px solid #e2e8f0',
                            background: tab === 'info' ? '#0f766e' : '#ffffff',
                            color: tab === 'info' ? '#ffffff' : '#334155',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Thông tin
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab(item.staffDependentId, 'documents')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: tab === 'documents' ? '1px solid #0f766e' : '1px solid #e2e8f0',
                            background: tab === 'documents' ? '#0f766e' : '#ffffff',
                            color: tab === 'documents' ? '#ffffff' : '#334155',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Hồ sơ ({activeDocs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab(item.staffDependentId, 'inactive_documents')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: tab === 'inactive_documents' ? '1px solid #64748b' : '1px solid #e2e8f0',
                            background: tab === 'inactive_documents' ? '#64748b' : '#ffffff',
                            color: tab === 'inactive_documents' ? '#ffffff' : '#475569',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Ngừng hoạt động ({expiredDocs.length})
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="button"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => navigate(`/employees/${id}/dependents/${item.staffDependentId}/edit`)}
                        >
                          <Icon name="edit" size={14} /> Sửa
                        </button>
                        <button
                          type="button"
                          className="button"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => openAddDocumentModal(item)}
                        >
                          <Icon name="plus" size={14} /> Thêm minh chứng
                        </button>
                        <button
                          type="button"
                          className="button"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          disabled={busyId === item.staffDependentId}
                          onClick={() => void handleToggleActive(item)}
                        >
                          {item.isActive ? 'Ngừng quản lý' : 'Quản lý lại'}
                        </button>
                      </div>
                    </div>

                    {/* Tab Content */}
                    {tab === 'info' ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                          gap: 10,
                          alignItems: 'center',
                          flex: 1,
                          minHeight: 0,
                        }}
                      >
                        <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #eef2f6' }}>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 2 }}>Ngày tạo</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{formatDate(item.createdAt)}</div>
                        </div>
                        <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #eef2f6' }}>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 2 }}>Số CCCD</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                            {item.idCardNumber || 'Chưa cập nhật'}
                          </div>
                        </div>
                        <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #eef2f6' }}>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 2 }}>Mã số thuế</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                            {item.taxCode || 'Chưa cập nhật'}
                          </div>
                        </div>
                        <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #eef2f6' }}>
                          <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 2 }}>Người đăng ký</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                            {item.registeredByName || '—'}
                          </div>
                        </div>
                      </div>
                    ) : tab === 'documents' ? (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          overflowY: 'auto',
                          paddingRight: 4,
                        }}
                      >
                        {activeDocs.length === 0 ? (
                          <div
                            style={{
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              background: '#f8fafc',
                              borderRadius: 8,
                              border: '1px dashed #cbd5e1',
                              fontSize: 13,
                              color: '#64748b',
                            }}
                          >
                            <span>Chưa có hồ sơ minh chứng đang hoạt động.</span>
                            <button
                              type="button"
                              className="button"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              onClick={() => openAddDocumentModal(item)}
                            >
                              + Tải hồ sơ
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {activeDocs.map(doc => (
                              <div
                                key={doc.documentId}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '160px minmax(0, 1fr) auto',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '6px 10px',
                                  background: '#f8fafc',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  fontSize: 12.5,
                                }}
                              >
                                <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {getDocumentTypeLabel(doc.documentType)}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {doc.fileUrl ? (
                                      <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#0f766e', textDecoration: 'underline', fontWeight: 500 }}
                                        title={doc.fileName}
                                      >
                                        {doc.fileName}
                                      </a>
                                    ) : (
                                      <span title={doc.fileName}>{doc.fileName} (bản cứng)</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    Tải lên: {formatDate(doc.uploadedAt)}
                                    {doc.verifiedByName ? ` · Xác nhận: ${doc.verifiedByName}` : ''}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  <span
                                    className={`status-badge ${doc.verificationStatus === 'verified' ? 'active' : ''}`}
                                    style={{ fontSize: 11.5, padding: '2px 8px' }}
                                  >
                                    {getVerificationStatusLabel(doc.verificationStatus)}
                                  </span>
                                  {doc.verificationStatus !== 'verified' && (
                                    <button
                                      type="button"
                                      className="button"
                                      style={{ padding: '3px 8px', fontSize: 11.5 }}
                                      disabled={busyId === doc.documentId}
                                      onClick={() => void handleVerifyDocument(item.staffDependentId, doc.documentId, 'verified')}
                                    >
                                      Xác nhận
                                    </button>
                                  )}
                                  {doc.verificationStatus === 'verified' ? (
                                    <button
                                      type="button"
                                      className="button"
                                      style={{ padding: '3px 8px', fontSize: 11.5 }}
                                      disabled={busyId === doc.documentId}
                                      onClick={() => void handleVerifyDocument(item.staffDependentId, doc.documentId, 'expired')}
                                    >
                                      Mất hiệu lực
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="button"
                                      style={{ padding: '3px 8px', fontSize: 11.5, color: '#b91c1c' }}
                                      disabled={busyId === doc.documentId}
                                      onClick={() => void handleRejectAndDeleteDocument(item.staffDependentId, doc.documentId, true)}
                                    >
                                      Từ chối
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          overflowY: 'auto',
                          paddingRight: 4,
                        }}
                      >
                        {expiredDocs.length === 0 ? (
                          <div
                            style={{
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: '#f8fafc',
                              borderRadius: 8,
                              border: '1px dashed #cbd5e1',
                              fontSize: 13,
                              color: '#64748b',
                            }}
                          >
                            Không có hồ sơ nào ngừng hoạt động (mất hiệu lực).
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {expiredDocs.map(doc => (
                              <div
                                key={doc.documentId}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '160px minmax(0, 1fr) auto',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '6px 10px',
                                  background: '#f1f5f9',
                                  borderRadius: 8,
                                  border: '1px solid #cbd5e1',
                                  fontSize: 12.5,
                                }}
                              >
                                <div style={{ fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {getDocumentTypeLabel(doc.documentType)}
                                </div>

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {doc.fileUrl ? (
                                      <a
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ color: '#475569', textDecoration: 'underline', fontWeight: 500 }}
                                        title={doc.fileName}
                                      >
                                        {doc.fileName}
                                      </a>
                                    ) : (
                                      <span title={doc.fileName}>{doc.fileName} (bản cứng)</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    Tải lên: {formatDate(doc.uploadedAt)}
                                    {doc.verifiedByName ? ` · Cập nhật bởi: ${doc.verifiedByName}` : ''}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  <span className="status-badge inactive" style={{ fontSize: 11.5, padding: '2px 8px' }}>
                                    Mất hiệu lực
                                  </span>
                                  <button
                                    type="button"
                                    className="button"
                                    style={{ padding: '3px 8px', fontSize: 11.5 }}
                                    disabled={busyId === doc.documentId}
                                    onClick={() => void handleVerifyDocument(item.staffDependentId, doc.documentId, 'verified')}
                                  >
                                    Khôi phục
                                  </button>
                                  <button
                                    type="button"
                                    className="button"
                                    style={{ padding: '3px 8px', fontSize: 11.5, color: '#b91c1c' }}
                                    disabled={busyId === doc.documentId}
                                    onClick={() => void handleRejectAndDeleteDocument(item.staffDependentId, doc.documentId, false)}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid #e2e8f0',
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            <span style={{ color: '#64748b' }}>
              Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, dependents.length)} / {dependents.length} người phụ thuộc
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="button"
                style={{ padding: '4px 10px', fontSize: 12.5 }}
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  className={page === safePage ? 'button primary' : 'button'}
                  style={{ padding: '4px 10px', fontSize: 12.5, minWidth: 32 }}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                className="button"
                style={{ padding: '4px 10px', fontSize: 12.5 }}
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Overlay: Thêm hồ sơ minh chứng */}
      {docTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thêm hồ sơ minh chứng"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleSubmitDocument}
            className="panel"
            style={{ width: '100%', maxWidth: 620, padding: 24, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Thêm hồ sơ minh chứng</h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Người phụ thuộc: <strong>{docTarget.fullName}</strong> ({getRelationshipLabel(docTarget.relationship)})
                </p>
              </div>
              <button type="button" className="button" onClick={() => setDocTarget(null)}>
                Đóng
              </button>
            </div>

            <div className="form-grid" style={{ marginTop: 0 }}>
              <div>
                <label htmlFor="add-doc-type">Loại giấy tờ</label>
                <select id="add-doc-type" value={docType} onChange={e => setDocType(e.target.value)}>
                  {DEPENDENT_DOCUMENT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="add-doc-name">
                  Tên tài liệu <span className="required">*</span>
                </label>
                <input
                  id="add-doc-name"
                  value={docFileName}
                  required
                  maxLength={255}
                  placeholder="Ví dụ: CCCD_mat_truoc.jpg"
                  onChange={e => setDocFileName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>Hình thức đính kèm tệp</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {(
                  [
                    { value: 'upload', label: 'Tải tệp lên' },
                    { value: 'url', label: 'Nhập đường dẫn' },
                    { value: 'none', label: 'Bản cứng (để trống)' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChangeDocSourceMode(opt.value)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: docSourceMode === opt.value ? '1px solid #0f766e' : '1px solid #cbd5e1',
                      background: docSourceMode === opt.value ? '#0f766e' : '#ffffff',
                      color: docSourceMode === opt.value ? '#ffffff' : '#334155',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {docSourceMode === 'upload' && (
                <div>
                  <input
                    id="add-doc-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    disabled={uploadingDoc}
                    onChange={e => void handleFileUpload(e)}
                  />
                  {uploadingDoc && <p className="field-hint">Đang tải tệp lên…</p>}
                  {!uploadingDoc && uploadedFileLabel && (
                    <p className="field-hint" style={{ color: '#0f766e', fontWeight: 500 }}>
                      Đã tải lên: {uploadedFileLabel}
                    </p>
                  )}
                </div>
              )}

              {docSourceMode === 'url' && (
                <div>
                  <input
                    id="add-doc-url"
                    value={docFileUrl}
                    maxLength={500}
                    placeholder="Nhập đường dẫn tệp (ví dụ: https://...)"
                    onChange={e => setDocFileUrl(e.target.value)}
                    aria-invalid={!!docUrlError}
                  />
                  {docUrlError && <p className="field-error" role="alert">{docUrlError}</p>}
                </div>
              )}

              {docSourceMode === 'none' && (
                <p className="field-hint" style={{ margin: 0 }}>
                  Ghi nhận hồ sơ nộp bản cứng, không lưu đường dẫn tệp đính kèm.
                </p>
              )}
            </div>

            {docError && (
              <div style={{ marginTop: 14 }}>
                <Alert variant="error">{docError}</Alert>
              </div>
            )}

            <div className="form-actions" style={{ marginTop: 20, padding: 0, borderTop: 'none' }}>
              <button type="button" className="button" disabled={savingDoc} onClick={() => setDocTarget(null)}>
                Hủy
              </button>
              <button type="submit" className="button primary" disabled={savingDoc || uploadingDoc}>
                <Icon name="check" size={16} />
                {savingDoc ? 'Đang lưu…' : 'Lưu hồ sơ minh chứng'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
