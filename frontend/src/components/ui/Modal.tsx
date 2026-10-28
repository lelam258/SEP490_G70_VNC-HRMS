import { useEffect, useRef, type ReactNode } from 'react';

export interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  maxWidth?: string;
}

export default function Modal({
  title,
  children,
  onClose,
  busy = false,
  maxWidth = '580px'
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) {
      el.showModal();
    }
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const rect = dialog.current?.getBoundingClientRect();
    if (rect) {
      const isOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (isOutside && !busy) {
        onClose();
      }
    }
  };

  return (
    <dialog
      ref={dialog}
      className="vnc vnc-modal-dialog"
      style={{ maxWidth }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="vnc-modal-header">
        <h2 className="vnc-modal-title">{title}</h2>
        <button
          type="button"
          className="vnc-modal-close-btn"
          aria-label="Đóng"
          disabled={busy}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="vnc-modal-content">
        {children}
      </div>
    </dialog>
  );
}
