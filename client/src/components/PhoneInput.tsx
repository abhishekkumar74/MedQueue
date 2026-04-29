/**
 * Reusable phone input — always prefixes +91, only allows 10 digits
 */
import { Phone } from 'lucide-react';

interface PhoneInputProps {
  value: string;           // stored as "+91XXXXXXXXXX"
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
  focusColor?: string;     // tailwind border color on focus e.g. 'focus:border-[#005EB8]'
}

export default function PhoneInput({
  value,
  onChange,
  disabled,
  className = '',
  focusColor = 'focus:border-[#005EB8]',
}: PhoneInputProps) {
  // Strip +91 prefix to get the 10-digit part for display
  const digits = value.startsWith('+91') ? value.slice(3) : value;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip everything except digits, then take only last 10
    // (handles paste of full number like "919876543210" or "+919876543210")
    let raw = e.target.value.replace(/\D/g, '');
    // If user pasted with country code (91XXXXXXXXXX), strip the leading 91
    if (raw.length > 10 && raw.startsWith('91')) {
      raw = raw.slice(2);
    }
    raw = raw.slice(0, 10);
    onChange('+91' + raw);
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* +91 prefix badge */}
      <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none select-none">
        <Phone className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-500 border-r border-gray-300 pr-2">+91</span>
      </div>
      <input
        type="tel"
        inputMode="numeric"
        value={digits}
        onChange={handleChange}
        disabled={disabled}
        placeholder="9876543210"
        maxLength={10}
        className={`w-full min-h-[44px] border-2 rounded-xl pl-20 pr-4 py-3 text-base focus:outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-400 ${
          digits.length > 0 && digits.length < 10
            ? 'border-red-400 focus:border-red-400'
            : focusColor + ' border-gray-200'
        }`}
      />
    </div>
  );
}

/** Helper: validate a +91XXXXXXXXXX phone number */
export function isValidPhone(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}
