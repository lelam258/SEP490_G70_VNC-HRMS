import { useEffect, useState, type KeyboardEvent } from 'react';
import { formatNumberWithDots, parseNumberFromDots } from '../../utils/format';

export interface MoneyInputProps {
  id?: string;
  name?: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  suffix?: string;
  className?: string;
  hasError?: boolean;
  onEnter?: () => void;
}

export default function MoneyInput({
  id,
  name,
  value,
  onChange,
  placeholder = '',
  disabled = false,
  required = false,
  autoFocus = false,
  suffix = '₫',
  className = '',
  hasError = false,
  onEnter,
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(
    value !== null && value !== undefined ? formatNumberWithDots(value) : ''
  );

  useEffect(() => {
    if (value === null || value === undefined) {
      setDisplayValue('');
    } else {
      const parsedCurrent = parseNumberFromDots(displayValue);
      if (parsedCurrent !== value) {
        setDisplayValue(formatNumberWithDots(value));
      }
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cleanDigits = raw.replace(/\D/g, '');
    if (!cleanDigits) {
      setDisplayValue('');
      onChange(null);
      return;
    }

    const num = Number(cleanDigits);
    setDisplayValue(formatNumberWithDots(cleanDigits));
    onChange(num);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onEnter?.();
    }
  }

  // Calculate right padding depending on suffix length
  const prClass = suffix.length > 2 ? 'pr-16' : 'pr-9';

  return (
    <div className="relative w-full">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`w-full h-10 rounded border ${
          hasError
            ? 'border-rose-500 focus:ring-rose-500'
            : 'border-slate-300 dark:border-slate-700 focus:ring-sky-500'
        } bg-white dark:bg-slate-800 px-3 ${prClass} text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 transition-colors ${
          disabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : ''
        } ${className}`}
        style={{
          fontVariantNumeric: 'tabular-nums',
          boxSizing: 'border-box',
          paddingRight: suffix ? (suffix.length > 2 ? '56px' : '36px') : '12px',
        }}
      />
      {suffix && (
        <span
          className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 text-sm font-medium select-none"
          aria-hidden="true"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
