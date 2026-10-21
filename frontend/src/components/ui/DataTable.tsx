import type { ReactNode } from 'react';

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode };
export default function DataTable<T>({ columns, rows, rowKey, emptyMessage }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; emptyMessage: string }) {
  if (!rows.length) return <div className="empty-state"><p>{emptyMessage}</p></div>;
  return <div className="table-scroll"><table><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
