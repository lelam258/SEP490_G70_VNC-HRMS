import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { contractApi } from '../../services/contractApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import { contractStatusLabels, salaryTypeLabels, type ContractDisplayStatus, type ContractListItem } from '../../types/contract';
import Alert from '../../components/ui/Alert';
import DataTable from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Pagination from '../../components/ui/Pagination';
import usePagination from '../../hooks/usePagination';
import { formatDateOnly, normalize } from '../../utils/format';

const STATUS_ORDER: ContractDisplayStatus[] = ['active', 'expiring', 'upcoming', 'expired', 'inactive'];

export default function ContractListPage() {
  const navigate = useNavigate();
  const storeNotice = useAppStore(state => state.notice);
  const clearStoreNotice = useAppStore(state => state.setNotice);
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [contractType, setContractType] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [rows, teams] = await Promise.all([contractApi.list(), departmentApi.list()]);
      setContracts(rows); setDepartments(teams);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const contractTypes = useMemo(() => [...new Set(contracts.map(c => c.contractType))].sort((a, b) => a.localeCompare(b, 'vi')), [contracts]);
  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return contracts
      .filter(c => (!term || normalize(`${c.contractCode || ''} ${c.staffCode} ${c.staffName}`).includes(term))
        && (!departmentId || c.departmentId === departmentId)
        && (!contractType || c.contractType === contractType)
        && (!status || c.displayStatus === status))
      .sort((a, b) => STATUS_ORDER.indexOf(a.displayStatus) - STATUS_ORDER.indexOf(b.displayStatus));
  }, [contracts, search, departmentId, contractType, status]);
  const pagination = usePagination(filtered);
  const hasFilters = !!(search || departmentId || contractType || status);
  const count = (s: ContractDisplayStatus) => contracts.filter(c => c.displayStatus === s).length;

  function resetFilters() { setSearch(''); setDepartmentId(''); setContractType(''); setStatus(''); pagination.resetPage(); }
  function onFilter<T>(setter: (value: T) => void) { return (value: T) => { setter(value); pagination.resetPage(); }; }

  return <section className="directory-page directory-contracts" aria-labelledby="contract-page-title">
    <header className="directory-heading">
      <div><span className="eyebrow">QUẢN LÝ NHÂN SỰ</span><h1 id="contract-page-title">Hợp đồng lao động</h1><p>Tra cứu hợp đồng lao động của nhân viên phòng khám.</p></div>
      <button className="button primary" disabled={loading} onClick={() => navigate('/contracts/new')}><Icon name="plus" size={17} />Tạo hợp đồng</button>
    </header>
    {error && <Alert>{error}</Alert>}
    {storeNotice && <Alert variant="success"><span>{storeNotice}</span><button className="icon-button" aria-label="Đóng thông báo" onClick={() => clearStoreNotice('')}><Icon name="close" size={15} /></button></Alert>}
    <section className="directory-panel" aria-label="Danh sách hợp đồng" aria-busy={loading}>
      <div className="directory-panel-heading">
        <div><h2>Danh sách hợp đồng <span>{loading ? '—' : contracts.length}</span></h2>
          <p>{loading ? 'Đang tải hợp đồng' : `${count('active')} đang hiệu lực · ${count('expiring')} sắp hết hạn · ${count('expired')} hết hạn`}</p></div>
        <button className="directory-refresh" disabled={loading} onClick={() => void load()}><Icon name="refresh" size={15} />Làm mới</button>
      </div>
      <div className="directory-filters">
        <label className="directory-search" htmlFor="contract-search">Tìm hợp đồng<span><Icon name="search" size={17} /><input id="contract-search" type="search" maxLength={100} placeholder="Số HĐ, mã hoặc tên nhân viên…" value={search} onChange={e => onFilter(setSearch)(e.target.value)} /></span></label>
        <label htmlFor="contract-filter-department">Khoa/phòng<select id="contract-filter-department" value={departmentId} onChange={e => onFilter(setDepartmentId)(e.target.value)}><option value="">Tất cả khoa/phòng</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label htmlFor="contract-filter-type">Loại hợp đồng<select id="contract-filter-type" value={contractType} onChange={e => onFilter(setContractType)(e.target.value)}><option value="">Tất cả loại</option>{contractTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label htmlFor="contract-filter-status">Trạng thái<select id="contract-filter-status" value={status} onChange={e => onFilter(setStatus)(e.target.value)}><option value="">Tất cả trạng thái</option>{STATUS_ORDER.map(s => <option key={s} value={s}>{contractStatusLabels[s]}</option>)}</select></label>
      </div>
      {hasFilters && <div className="directory-filter-summary"><span><strong>{filtered.length}</strong> hợp đồng phù hợp</span><button type="button" onClick={resetFilters}>Xóa bộ lọc<Icon name="close" size={13} /></button></div>}
      <div className="directory-table">{loading ? <p className="directory-loading" role="status">Đang tải danh sách hợp đồng…</p> : <DataTable rows={pagination.visible} rowKey={c => c.contractId} caption="Danh sách hợp đồng lao động" emptyMessage="Không tìm thấy kết quả phù hợp."
        emptyState={<div className="directory-empty"><span><Icon name="fileText" size={28} /></span><h3>{hasFilters ? 'Không tìm thấy hợp đồng' : 'Chưa có hợp đồng'}</h3><p>{hasFilters ? 'Thử từ khóa khác hoặc thay đổi bộ lọc.' : 'Tạo hợp đồng đầu tiên cho nhân viên.'}</p>{hasFilters && <button type="button" className="button" onClick={resetFilters}>Xóa bộ lọc</button>}</div>}
        columns={[
          { key: 'code', label: 'Số HĐ', className: 'directory-col-code', render: c => <button type="button" className="directory-person-link" onClick={() => navigate(`/contracts/${c.contractId}`)} aria-label={`Xem hợp đồng ${c.contractCode || c.staffName}`}>{c.contractCode || 'Chưa có số'}</button> },
          { key: 'person', label: 'Nhân viên', className: 'directory-col-person', render: c => <div className="directory-person"><div><strong>{c.staffName}</strong><small>{c.staffCode}{c.positionName ? ` · ${c.positionName}` : ''}</small></div></div> },
          { key: 'department', label: 'Khoa/phòng', className: 'directory-col-department', render: c => <div><span className={c.departmentName ? 'directory-department' : 'directory-secondary'}>{c.departmentName || 'Chưa phân khoa'}</span>{c.siteName && <small className="directory-secondary" style={{ display: 'block' }}>{c.siteName}</small>}</div> },
          { key: 'type', label: 'Loại hợp đồng', render: c => <div><span>{c.contractType}</span><small className="directory-secondary" style={{ display: 'block' }}>Lương {(salaryTypeLabels[c.salaryType] || c.salaryType).toLowerCase()}</small></div> },
          { key: 'term', label: 'Hiệu lực', render: c => <span>{formatDateOnly(c.effectiveFrom)} – {c.effectiveTo ? formatDateOnly(c.effectiveTo) : 'Không thời hạn'}</span> },
          { key: 'status', label: 'Trạng thái', className: 'directory-col-status', render: c => <span className={`directory-status ${c.displayStatus}`}><i />{contractStatusLabels[c.displayStatus]}</span> },
          { key: 'actions', label: 'Thao tác', className: 'directory-col-actions', render: c => <div className="directory-actions">
            {c.fileUrl && <a className="directory-action" href={c.fileUrl} target="_blank" rel="noreferrer" aria-label={`Mở tệp hợp đồng ${c.contractCode || ''}`}><Icon name="file" size={15} /></a>}
            <button className="directory-action" onClick={() => navigate(`/contracts/${c.contractId}`)}><Icon name="eye" size={15} />Xem</button>
          </div> }]} />}</div>
      <Pagination total={filtered.length} page={pagination.page} pageSize={pagination.pageSize} label="hợp đồng" disabled={loading} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </section>
  </section>;
}
