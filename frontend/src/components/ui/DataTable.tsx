import { useState, useMemo, type ReactNode } from 'react';

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
};

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  defaultSortKey,
  defaultSortDirection = 'asc',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;
    if (sortKey === column.key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(column.key);
      setSortDirection('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;

    return [...rows].sort((a, b) => {
      let valA = col.sortValue ? col.sortValue(a) : (a as any)[sortKey];
      let valB = col.sortValue ? col.sortValue(b) : (b as any)[sortKey];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB), 'vi', { numeric: true, sensitivity: 'base' });
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDirection, columns]);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={`${column.headerClassName || ''} ${
                    column.sortable
                      ? 'cursor-pointer select-none transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800'
                      : ''
                  }`.trim()}
                  onClick={() => handleSort(column)}
                  title={column.sortable ? `Bấm để sắp xếp theo ${column.label}` : undefined}
                >
                  <div className="inline-flex items-center gap-1.5">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="inline-flex items-center text-[11px] leading-none shrink-0" aria-hidden="true">
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <span className="text-sky-600 dark:text-sky-400 font-bold">▲</span>
                          ) : (
                            <span className="text-sky-600 dark:text-sky-400 font-bold">▼</span>
                          )
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 hover:text-slate-500 font-bold">⇅</span>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
