import { useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Checkbox from '../components/Checkbox';
import { LogoMark } from '../components/Logo';
import PasswordField from '../components/PasswordField';
import TextField from '../components/TextField';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { isAuthenticated, sessionExpired, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  if (isAuthenticated) {
    const from = location.state?.from;
    const target = from && from.pathname !== '/login' ? `${from.pathname}${from.search ?? ''}` : '/';
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const next = {};
    if (!email.trim()) next.email = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setAuthError('');
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    setLoading(true);
    try {
      await login(email, password, remember);
      // The redirect above takes over once the session exists.
    } catch (err) {
      setAuthError(err.message);
      setLoading(false);
      // Only a wrong email/password points at the password field; network,
      // server and "not an admin" errors are shown in the alert alone.
      if (err.status === 401) {
        setErrors({ password: 'Check your password and try again.' });
        passwordRef.current?.select();
        passwordRef.current?.focus();
      }
    }
  };

  return (
    <div className="login-page">
      <main className="card login-card">
        <div className="login-card__brand">
          <LogoMark size="lg" />
          <h1 className="login-card__title">Alzaryab Cash &amp; Carry</h1>
          <span className="pill">Admin Portal</span>
        </div>

        <form className="login-form" noValidate onSubmit={handleSubmit} aria-busy={loading || undefined}>
          {authError && (
            <Alert variant="error" role="alert" title="Login failed">
              {authError}
            </Alert>
          )}

          {!authError && sessionExpired && (
            <Alert variant="warning" role="status" title="Session expired">
              Please sign in again to continue.
            </Alert>
          )}

          <TextField
            ref={emailRef}
            id="login-email"
            label="Email Address"
            type="email"
            required
            autoComplete="username"
            placeholder="admin@alzaryab.pk"
            leadingIcon={Mail}
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: '' }));
            }}
          />

          <PasswordField
            ref={passwordRef}
            id="login-password"
            label="Password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((p) => ({ ...p, password: '' }));
            }}
          />

          <div className="login-form__row">
            <Checkbox
              id="login-remember"
              label="Remember me"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
          </div>

          <Button type="submit" block loading={loading} loadingText="Signing in…">
            Login
          </Button>
        </form>

        <p className="login-card__note">Authorized administrators only.</p>
      </main>
    </div>
  );
}
