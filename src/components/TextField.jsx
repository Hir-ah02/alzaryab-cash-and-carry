import { CircleAlert } from 'lucide-react';
import cx from '../utils/cx';
import Field, { describedBy } from './Field';

/**
 * Text input with label, helper text, error state and optional
 * leading icon / text prefix / trailing content.
 * Also the base for PasswordField, NumberField and SearchInput.
 */
export default function TextField({
  id,
  label,
  required,
  helper,
  error,
  hideLabel,
  leadingIcon: LeadingIcon,
  prefix,
  trailing,
  size = 'md',
  disabled,
  className,
  ref,
  ...inputProps
}) {
  return (
    <Field id={id} label={label} required={required} helper={helper} error={error} hideLabel={hideLabel} className={className}>
      <div
        className={cx(
          'field__control',
          size === 'lg' && 'field__control--lg',
          error && 'is-invalid',
          disabled && 'is-disabled',
        )}
      >
        {prefix && (
          <span className="field__prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        {LeadingIcon && (
          <span className="field__lead-icon" aria-hidden="true">
            <LeadingIcon size={18} />
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className="field__input"
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          {...inputProps}
        />
        {(error || trailing) && (
          <span className="field__trailing">
            {error && (
              <span className="field__error-icon" aria-hidden="true">
                <CircleAlert size={18} />
              </span>
            )}
            {trailing}
          </span>
        )}
      </div>
    </Field>
  );
}
