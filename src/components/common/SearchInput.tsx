import { Search, X } from 'lucide-react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  return (
    <div className={styles.wrap}>
      <Search className={styles.icon} size={16} aria-hidden="true" />
      <input
        type="search"
        className={styles.input}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
      />
      {value && (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
