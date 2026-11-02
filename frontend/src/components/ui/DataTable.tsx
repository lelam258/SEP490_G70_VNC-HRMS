import type { ReactNode } from 'react';

export type Column<T> = { key: string; label: string; className?: string; render: (row: T) => ReactNode };
export default function DataTable<T>({ columns, rows, rowKey, emptyMessage, caption, emptyState }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; emptyMessage: string; caption?: string; emptyState?: ReactNode }) {
  if (!rows.length) return emptyState ?? <div className="empty-state"><p>{emptyMessage}</p></div>;
  return <div className="table-scroll"><table>{caption && <caption className="sr-only">{caption}</caption>}<thead><tr>{columns.map(column => <th key={column.key} scope="col" className={column.className}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.key} className={column.className} data-label={column.label}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
