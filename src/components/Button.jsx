import cx from '../utils/cx';

/**
 * Button
 * variant: primary | secondary | tertiary | danger
 * size:    md (40px) | sm (32px)
 * loading: shows a spinner and `loadingText` (e.g. "Saving…") and disables the button
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  loadingText,
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  block = false,
  disabled = false,
  className,
  children,
  ref,
  ...props
}) {
  const iconSize = size === 'sm' ? 16 : 18;
  return (
    <button
      ref={ref}
      type={type}
      className={cx('btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block', loading && 'is-loading', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : (
        LeadingIcon && <LeadingIcon size={iconSize} aria-hidden="true" />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && TrailingIcon && <TrailingIcon size={iconSize} aria-hidden="true" />}
    </button>
  );
}
