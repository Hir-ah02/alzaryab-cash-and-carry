import { ChevronDown, CircleAlert } from 'lucide-react';
import cx from '../utils/cx';
import Field, { describedBy } from './Field';

/**
 * Native select styled to match the inputs.
 * options: [{ value, label }] or plain strings.
 * placeholder: shown as a disabled first option when value is ''.
 */
export default function Select({
  id,
  label,
  required,
  helper,
  error,
  hideLabel,
  options,
  placeholder,
  value,
  disabled,
  className,
  ref,
  ...selectProps
}) {
  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  return (
    <Field id={id} label={label} required={required} helper={helper} error={error} hideLabel={hideLabel} className={className}>
      <div className={cx('field__control', error && 'is-invalid', disabled && 'is-disabled')}>
        <select
          ref={ref}
          id={id}
          className={cx('field__input', 'field__select', placeholder && value === '' && 'is-placeholder')}
          value={value}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          {...selectProps}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {normalized.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="field__trailing field__trailing--select" aria-hidden="true">
            <span className="field__error-icon">
              <CircleAlert size={18} />
            </span>
          </span>
        )}
        <span className="field__chevron" aria-hidden="true">
          <ChevronDown size={18} />
        </span>
      </div>
    </Field>
  );
}
