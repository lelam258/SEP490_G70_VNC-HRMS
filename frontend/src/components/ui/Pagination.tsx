import { useId } from 'react';
import Icon from './Icon';

export default function Pagination({ total, page, pageSize, label, disabled, onPageChange, onPageSizeChange }: {
  total: number; page: number; pageSize: number; label: string; disabled?: boolean;
  onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void;
}) {
  const selectId = useId();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = pages <= 7 ? 1 : Math.max(2, Math.min(page - 1, pages - 3));
  const end = pages <= 7 ? pages : Math.min(pages - 1, start + 2);
  const visiblePages = [...new Set([1, ...Array.from({ length: end - start + 1 }, (_, i) => start + i), pages])];
  return <footer className="directory-pagination">
    <div className="directory-page-info"><span role="status" aria-live="polite">Hiển thị <strong>{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}</strong> trong <strong>{total}</strong> {label}</span>
      <label htmlFor={selectId}>Số dòng<select id={selectId} aria-label={`Số dòng mỗi trang ${label}`} value={pageSize} disabled={disabled} onChange={event => onPageSizeChange(Number(event.target.value))}>{[5, 10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    <nav aria-label={`Phân trang ${label}`}><button type="button" className="directory-page-arrow" aria-label="Trang trước" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}><Icon name="arrow" size={15} /><span>Trước</span></button>
      {visiblePages.map((number, i) => <span key={number} className="directory-page-item">{i > 0 && number - visiblePages[i - 1] > 1 && <span className="directory-page-ellipsis" aria-hidden="true">…</span>}<button type="button" className={number === page ? 'is-current' : ''} aria-label={`Trang ${number}`} aria-current={number === page ? 'page' : undefined} disabled={disabled} onClick={() => onPageChange(number)}>{number}</button></span>)}
      <button type="button" className="directory-page-arrow" aria-label="Trang sau" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}><span>Sau</span><Icon name="chevron" size={15} /></button></nav>
  </footer>;
}
