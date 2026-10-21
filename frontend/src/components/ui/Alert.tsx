import type { ReactNode } from 'react';

export default function Alert({ children, variant = 'error' }: { children: ReactNode; variant?: 'error' | 'success' }) {
  return <div className={`alert ${variant}`} role={variant === 'error' ? 'alert' : 'status'}>{children}</div>;
}
