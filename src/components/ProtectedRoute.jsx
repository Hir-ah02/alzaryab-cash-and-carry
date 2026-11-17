import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

/** Redirects to /login when there is no session, remembering where the user was going. */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
