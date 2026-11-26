import { useEffect, useState } from 'react';

export default function usePagination<T>(rows: T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  return {
    page: currentPage, pageSize,
    visible: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    setPage,
    setPageSize: (size: number) => { setSize(size); setPage(1); },
    resetPage: () => setPage(1),
  };
}
