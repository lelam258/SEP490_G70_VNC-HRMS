import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ModalContextValue {
  requestClose: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal() {
  return useContext(ModalContext);
}

export interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  maxWidth?: string;
  className?: string;
  hasUnsavedChanges?: boolean;
}

export default function Modal({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
  maxWidth = '580px',
  className = '',
  hasUnsavedChanges = false,
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) {
      el.showModal();
    }
  }, []);

  const requestClose = () => {
    if (busy) return;
    if (hasUnsavedChanges) {
      setShowUnsavedPrompt(true);
      return;
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    // Nếu đang hiển thị xác nhận thì không đóng modal qua click backdrop
    if (showUnsavedPrompt) return;

    const rect = dialog.current?.getBoundingClientRect();
    if (rect) {
      const isOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;
      if (isOutside) {
        requestClose();
      }
    }
  };

  const is600 = maxWidth === '600px' || className.includes('vnc-modal-600');
  const dialogClass = `vnc vnc-modal-dialog relative ${is600 ? 'vnc-modal-600' : ''} ${className}`.trim();

  return (
    <ModalContext.Provider value={{ requestClose }}>
      <dialog
        ref={dialog}
        className={dialogClass}
        style={{ maxWidth }}
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onClick={handleBackdropClick}
      >
        <div className="vnc-modal-header">
          <div className="min-w-0 pr-2">
            <h2 className="vnc-modal-title">{title}</h2>
            {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="vnc-modal-close-btn"
            aria-label="Đóng"
            disabled={busy}
            onClick={requestClose}
          >
            ✕
          </button>
        </div>
        <div className="vnc-modal-content">
          {children}
        </div>

        {/* Modal xác nhận thoát khi có thay đổi chưa lưu (thay thế browser confirm native) */}
        {showUnsavedPrompt && (
          <div
            className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 mb-4 shadow-xs">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Bỏ các thay đổi chưa lưu?
              </h3>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Bạn có dữ liệu đã chỉnh sửa nhưng chưa lưu. Nếu đóng bây giờ, mọi thay đổi sẽ bị mất.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setShowUnsavedPrompt(false)}
                  className="flex-1 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Tiếp tục sửa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedPrompt(false);
                    onClose();
                  }}
                  className="flex-1 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-medium text-white transition-colors shadow-sm"
                >
                  Bỏ thay đổi
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </ModalContext.Provider>
  );
}
