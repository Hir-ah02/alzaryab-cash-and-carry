/** Small shared building blocks: buttons, fields, notices and page states. */
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-line-strong disabled:text-white',
  secondary: 'bg-white text-ink border border-line-strong hover:bg-surface-muted disabled:text-ink-3',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-ink-3',
  danger: 'bg-white text-danger border border-danger/30 hover:bg-danger-bg disabled:text-ink-3',
};
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed select-none',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, fullWidth, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, cx(fullWidth && 'w-full', className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Spinner({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx('flex items-center justify-center gap-2 py-12 text-ink-2', className)}>
      <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';
const TONES: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-brand-50 border-brand-100 text-brand-800', icon: <Info className="size-5 shrink-0" aria-hidden /> },
  success: { box: 'bg-brand-50 border-brand-100 text-brand-800', icon: <CheckCircle2 className="size-5 shrink-0" aria-hidden /> },
  warning: { box: 'bg-warn-bg border-amber-200 text-warn', icon: <TriangleAlert className="size-5 shrink-0" aria-hidden /> },
  error: { box: 'bg-danger-bg border-red-200 text-danger', icon: <AlertCircle className="size-5 shrink-0" aria-hidden /> },
};

export function Notice({ tone = 'info', title, children, action, className }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border p-3.5 text-sm', TONES[tone].box, className)}>
      {TONES[tone].icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5', 'leading-relaxed')}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1.5 text-sm text-ink-2">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Notice tone="error" title={title} action={onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}>
        {message}
      </Notice>
    </div>
  );
}

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

function FieldShell({ label, error, hint, optional, children }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label} {optional && <span className="font-normal text-ink-3">(optional)</span>}
      </label>
      {children({ id, describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass = (error?: string) =>
  cx(
    'block w-full rounded-xl border bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-brand-600/25 disabled:bg-surface-muted disabled:text-ink-2',
    error ? 'border-danger focus:border-danger' : 'border-line-strong focus:border-brand-600',
  );

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, error, hint, optional, className, ...rest }, ref) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional}>
      {({ id, describedBy }) => (
        <input ref={ref} id={id} aria-invalid={!!error || undefined} aria-describedby={describedBy} className={cx(inputClass(error), 'h-11', className)} {...rest} />
      )}
    </FieldShell>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

export function TextArea({ label, error, hint, optional, className, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional}>
      {({ id, describedBy }) => (
        <textarea id={id} aria-invalid={!!error || undefined} aria-describedby={describedBy} className={cx(inputClass(error), 'min-h-20 py-2.5', className)} {...rest} />
      )}
    </FieldShell>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-white', className)}>{children}</div>;
}

export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SummaryRow({ label, value, strong, muted }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-1', strong ? 'text-base font-bold' : 'text-sm', muted && 'text-ink-2')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
