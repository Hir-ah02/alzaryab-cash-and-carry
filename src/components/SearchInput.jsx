import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import TextField from './TextField';

export default function SearchInput({ value, onChange, onClear, label = 'Search', ...props }) {
  const inputRef = useRef(null);

  const clear = () => {
    onClear();
    inputRef.current?.focus();
  };

  return (
    <TextField
      {...props}
      ref={inputRef}
      type="search"
      label={label}
      hideLabel
      size="lg"
      leadingIcon={Search}
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && value) {
          e.preventDefault();
          clear();
        }
      }}
      autoComplete="off"
      trailing={
        value ? (
          <button type="button" className="field__toggle" onClick={clear} aria-label="Clear search">
            <X size={16} aria-hidden="true" />
          </button>
        ) : null
      }
    />
  );
}
