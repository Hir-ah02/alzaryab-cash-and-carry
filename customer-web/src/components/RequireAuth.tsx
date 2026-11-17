import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { loginPath } from '@/auth/returnTo';

import { Spinner } from './ui';

/** Customer-only pages: signed-out visitors go to sign in, then come back here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'restoring') return <Spinner label="Checking your session…" />;
  if (status === 'signedOut') return <Navigate to={loginPath(location.pathname + location.search)} replace />;
  return <>{children}</>;
}
