import { useEffect, useId, useRef, type ReactNode } from 'react';

export default function Modal({ title, children, onClose, busy = false, className = '' }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const current = dialog.current;
    const opener = document.activeElement;
    current?.showModal();
    return () => {
      current?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={dialog} aria-labelledby={headingId} className={`vnc w-[min(95vw,640px)] rounded-xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/40 ${className}`}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 id={headingId} className="text-lg font-semibold">{title}</h2>
      <button type="button" className="icon-button" aria-label="Đóng" disabled={busy} onClick={onClose}>×</button></div>{children}
  </dialog>;
}
