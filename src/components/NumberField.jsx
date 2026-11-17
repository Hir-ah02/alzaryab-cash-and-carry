import TextField from './TextField';

/**
 * Numeric input. Uses a text input with inputMode so partial / invalid
 * values can be validated with friendly messages.
 * currency: shows an "Rs." prefix.
 */
export default function NumberField({ currency = false, allowDecimal = false, ...props }) {
  return (
    <TextField
      {...props}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      prefix={currency ? 'Rs.' : undefined}
    />
  );
}
