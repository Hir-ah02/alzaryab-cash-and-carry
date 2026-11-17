import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';

import { confirmPasswordReset, requestPasswordReset } from '@/api/auth';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { safeReturnPath } from '@/auth/returnTo';
import { Logo } from '@/components/Logo';
import { Button, Card, Notice, TextField } from '@/components/ui';
import {
  emailError,
  normalizePhone,
  passwordError,
  resetCodeError,
  splitFullName,
  validateLogin,
  validateRegistration,
  type RegistrationValues,
} from '@/utils/validation';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-14">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <Card className="p-5 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
    </div>
  );
}

function PasswordInput(props: { label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextField
        label={props.label}
        type={show ? 'text' : 'password'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        error={props.error}
        hint={props.hint}
        autoComplete={props.autoComplete}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-[30px] rounded-lg p-2 text-ink-3 hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function useNextPath() {
  const [params] = useSearchParams();
  return safeReturnPath(params.get('next'));
}

export function LoginPage() {
  const { status, signIn, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = useNextPath();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resetDone = (location.state as { passwordReset?: boolean } | null)?.passwordReset;

  if (status === 'signedIn' && !loading) return <Navigate to={next ?? '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const found = validateLogin(email, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(next ?? '/', { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not sign in.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the same account as the Al Zaryab app."
      footer={<>New to Al Zaryab? <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-brand-700 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {resetDone && <Notice tone="success">Your password has been changed. Sign in with your new password.</Notice>}
        {sessionExpired && !formError && <Notice tone="warning">Your session has ended. Please sign in again.</Notice>}
        {formError && <Notice tone="error">{formError}</Notice>}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoFocus />
        <PasswordInput label="Password" autoComplete="current-password" value={password} onChange={setPassword} error={errors.password} />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-700 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={loading}>Sign in</Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const next = useNextPath();
  const [values, setValues] = useState<RegistrationValues>({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'signedIn' && !loading) return <Navigate to={next ?? '/'} replace />;

  const set = (key: keyof RegistrationValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const found = validateRegistration(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setLoading(true);
    try {
      const { firstName, lastName } = splitFullName(values.fullName);
      await register({
        email: values.email,
        password: values.password,
        firstName,
        lastName,
        phone: values.phone.trim() ? normalizePhone(values.phone) : '',
      });
      navigate(next ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        const f = err.fields;
        setErrors({ fullName: f.firstName ?? f.lastName, email: f.email, phone: f.phone, password: f.password });
        setFormError(err.message === 'Please check the highlighted details.' ? null : err.message);
      } else setFormError(err instanceof Error ? err.message : 'Could not create your account.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for the website and the Al Zaryab app."
      footer={<>Already have an account? <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-brand-700 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Notice tone="error">{formError}</Notice>}
        <TextField label="Full name" autoComplete="name" value={values.fullName} onChange={set('fullName')} error={errors.fullName} autoFocus />
        <TextField label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
        <TextField label="Phone number" type="tel" autoComplete="tel" optional placeholder="03001234567" value={values.phone} onChange={set('phone')} error={errors.phone} />
        <PasswordInput label="Password" autoComplete="new-password" value={values.password} onChange={(v) => setValues((s) => ({ ...s, password: v }))} error={errors.password} hint="At least 8 characters, not only numbers." />
        <PasswordInput label="Confirm password" autoComplete="new-password" value={values.confirmPassword} onChange={(v) => setValues((s) => ({ ...s, confirmPassword: v }))} error={errors.confirmPassword} />
        <Button type="submit" size="lg" fullWidth loading={loading}>Create account</Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = emailError(email);
    setError(found);
    setFormError(null);
    if (found || loading) return;
    setLoading(true);
    try {
      const message = await requestPasswordReset(email);
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`, { state: { message } });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a 6-digit code." footer={<Link to="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && <Notice tone="error">{formError}</Notice>}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoFocus />
        <Button type="submit" size="lg" fullWidth loading={loading}>Send code</Button>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sentMessage = (location.state as { message?: string } | null)?.message;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = { email: emailError(email), code: resetCodeError(code), password: passwordError(password) };
    setErrors(found);
    setFormError(null);
    if (Object.values(found).some(Boolean) || loading) return;
    setLoading(true);
    try {
      await confirmPasswordReset({ email, code, password });
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      if (err instanceof ApiError && err.fields.password) setErrors({ password: err.fields.password });
      else setFormError(err instanceof Error ? err.message : 'Please try again.');
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Set a new password" footer={<Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">Didn't get a code? Send another</Link>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {sentMessage && <Notice tone="info">{sentMessage}</Notice>}
        {formError && <Notice tone="error">{formError}</Notice>}
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} error={errors.code} />
        <PasswordInput label="New password" autoComplete="new-password" value={password} onChange={setPassword} error={errors.password} hint="At least 8 characters, not only numbers." />
        <Button type="submit" size="lg" fullWidth loading={loading}>Change password</Button>
      </form>
    </AuthShell>
  );
}
