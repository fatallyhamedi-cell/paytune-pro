import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useRequireAuth() {
  const navigate = useNavigate();

  const checkAuth = useCallback((): boolean => {
    const userToken = localStorage.getItem('user_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('paytune_auth_token') ||
      localStorage.getItem('paytune_custom_session');

    return Boolean(userToken);
  }, []);

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
