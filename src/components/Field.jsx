import cx from '../utils/cx';

/** aria-describedby value for a field: the error replaces the helper text. */
export function describedBy(id, helper, error) {
  if (error) return `${id}-error`;
  if (helper) return `${id}-helper`;
  return undefined;
}

/**
 * Shared wrapper for every input: label (+ required asterisk),
 * the control itself, then helper text or the error message.
 */
export default function Field({ id, label, required, helper, error, hideLabel, className, children }) {
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id} className={cx('field__label', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="field__helper">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
