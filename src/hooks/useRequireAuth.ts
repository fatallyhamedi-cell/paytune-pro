import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export function useRequireAuth() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const checkAuth = useCallback((): boolean => {
    // 1. Check direct user_token as explicitly required
    const userToken = localStorage.getItem('user_token');
    if (userToken) {
      return true;
    }

    // 2. Also check active user session / other supported tokens
    if (user) {
      return true;
    }

    const fallbackToken =
      localStorage.getItem('token') ||
      localStorage.getItem('paytune_auth_token') ||
      localStorage.getItem('paytune_custom_session');

    return Boolean(fallbackToken);
  }, [user]);

  const requireAuth = useCallback(
    (actionCallback?: () => void, alertMessage: string = 'Please sign in to perform this action.'): boolean => {
      const isAuthed = checkAuth();

      if (!isAuthed) {
        console.warn('[useRequireAuth] Unauthenticated action blocked. Redirecting to /login');
        if (alertMessage) {
          alert(alertMessage);
        }
        navigate('/login');
        return false;
      }

      if (actionCallback) {
        actionCallback();
      }
      return true;
    },
    [checkAuth, navigate]
  );

  return {
    requireAuth,
    isAuthenticated: checkAuth()
  };
}

export default useRequireAuth;
