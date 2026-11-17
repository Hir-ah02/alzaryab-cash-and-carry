import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * /logout – clears the session and sends the user to /login.
 * Logout is a route (not a direct call) so an unsaved-changes guard on
 * the form pages can cancel it.
 */
export default function LogoutPage() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    logout();
    toast.success('Signed out', 'You have been logged out of the Admin Portal.');
    navigate('/login', { replace: true });
  }, [logout, navigate, toast]);

  return null;
}
