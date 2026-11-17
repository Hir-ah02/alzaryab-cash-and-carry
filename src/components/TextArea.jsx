import cx from '../utils/cx';
import Field, { describedBy } from './Field';

/** Multi-line text input, styled like TextField. */
export default function TextArea({ id, label, required, helper, error, hideLabel, disabled, className, rows = 4, ref, ...props }) {
  return (
    <Field id={id} label={label} required={required} helper={helper} error={error} hideLabel={hideLabel} className={className}>
      <div className={cx('field__control', 'field__control--textarea', error && 'is-invalid', disabled && 'is-disabled')}>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className="field__input field__textarea"
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, helper, error)}
          {...props}
        />
      </div>
    </Field>
  );
}
