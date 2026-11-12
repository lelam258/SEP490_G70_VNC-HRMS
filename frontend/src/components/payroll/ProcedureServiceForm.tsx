import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import type { SaveProcedureServiceInput } from '../../types/procedureService';

export interface ProcedureServiceFormProps {
  initial?: {
    serviceCode: string;
    serviceName: string;
    category?: string | null;
    basePrice?: number | null;
    status: string;
    slipCount?: number;
  };
  categories?: string[];
  onSave: (value: SaveProcedureServiceInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}

const DEFAULT_CATEGORY_SUGGESTIONS = [
  'Chẩn đoán hình ảnh',
  'Thủ thuật ngoại khoa',
  'Xét nghiệm',
  'Nội soi',
  'Phục hồi chức năng',
  'Răng hàm mặt',
  'Sản phụ khoa',
  'Khác',
];

export default function ProcedureServiceForm({
  initial,
  categories = [],
  onSave,
  onClose,
  busy,
  error,
}: ProcedureServiceFormProps) {
  const [code, setCode] = useState(initial?.serviceCode || '');
  const [name, setName] = useState(initial?.serviceName || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [basePrice, setBasePrice] = useState<number | null>(
    initial?.basePrice !== undefined && initial?.basePrice !== null ? initial.basePrice : null
  );
  const [status, setStatus] = useState(initial?.status || 'active');
  const [validationError, setValidationError] = useState('');

  const codeLocked = !!(initial && (initial.slipCount ?? 0) > 0);
  const allSuggestions = Array.from(
    new Set([...categories.filter(Boolean), ...DEFAULT_CATEGORY_SUGGESTIONS])
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanCategory = category.trim();

    if (!cleanCode || !cleanName) {
      setValidationError('Mã thủ thuật và tên thủ thuật không được để trống.');
      return;
    }

    if (cleanCode.length > 30) {
      setValidationError('Mã thủ thuật tối đa 30 ký tự.');
      return;
    }

    if (cleanName.length > 200) {
      setValidationError('Tên thủ thuật tối đa 200 ký tự.');
      return;
    }

    if (basePrice !== null && basePrice < 0) {
      setValidationError('Đơn giá niêm yết không được âm.');
      return;
    }

    setValidationError('');
    if (!busy) {
      void onSave({
        code: cleanCode,
        name: cleanName,
        category: cleanCategory || null,
        basePrice,
        status,
      });
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="procedure-service-code" className="block text-sm font-medium text-slate-700 mb-1">
              Mã thủ thuật <span className="text-rose-500">*</span>
            </label>
            <input
              id="procedure-service-code"
              required
              maxLength={30}
              disabled={busy || codeLocked}
              placeholder="VD: CLVT-01, SA-01..."
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full h-10 rounded border border-slate-300 px-3 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
            {codeLocked ? (
              <p className="text-xs text-amber-600 mt-1">
                Mã thủ thuật đã phát sinh phiếu nên không thể thay đổi.
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Tối đa 30 ký tự, tự động viết hoa.</p>
            )}
          </div>

          <div>
            <label htmlFor="procedure-service-category" className="block text-sm font-medium text-slate-700 mb-1">
              Nhóm dịch vụ / Chuyên khoa
            </label>
            <input
              id="procedure-service-category"
              list="procedure-service-category-list"
              maxLength={100}
              disabled={busy}
              placeholder="Chọn hoặc nhập nhóm dịch vụ..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 rounded border border-slate-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <datalist id="procedure-service-category-list">
              {allSuggestions.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <p className="text-xs text-slate-500 mt-1">
              Dùng để phân loại và áp dụng quy tắc hoa hồng theo nhóm.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="procedure-service-name" className="block text-sm font-medium text-slate-700 mb-1">
            Tên dịch vụ thủ thuật <span className="text-rose-500">*</span>
          </label>
          <input
            id="procedure-service-name"
            required
            maxLength={200}
            disabled={busy}
            placeholder="VD: Chụp cắt lớp vi tính (CLVT), Siêu âm Doppler màu..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 rounded border border-slate-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="procedure-service-price" className="block text-sm font-medium text-slate-700 mb-1">
              Đơn giá niêm yết (VND)
            </label>
            <MoneyInput
              id="procedure-service-price"
              value={basePrice}
              onChange={setBasePrice}
              disabled={busy}
              placeholder="Nhập đơn giá mặc định (nếu có)"
            />
            <p className="text-xs text-slate-500 mt-1">
              Tự động gợi ý số tiền thu khi lập phiếu thủ thuật mới.
            </p>
          </div>

          {initial && (
            <div>
              <label htmlFor="procedure-service-status" className="block text-sm font-medium text-slate-700 mb-1">
                Trạng thái hoạt động
              </label>
              <select
                id="procedure-service-status"
                disabled={busy}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 rounded border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng sử dụng (Vô hiệu hóa)</option>
              </select>
            </div>
          )}
        </div>

        {(validationError || error) && <Alert>{validationError || error}</Alert>}
      </div>

      <div className="form-actions mt-6">
        <button className="button" type="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : initial ? 'Cập nhật thủ thuật' : 'Tạo thủ thuật'}
        </button>
      </div>
    </form>
  );
}
