import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);
const IMPERSONATION_STORAGE_KEY = 'gw_admin_impersonation';

// Manage authentication state for platform admins and store accounts
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('gw_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('gw_user');
    return raw ? JSON.parse(raw) : null;
  });

  const loginSuccess = ({ token: nextToken, user: nextUser }) => {
    localStorage.setItem('gw_token', nextToken);
    localStorage.setItem('gw_user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem('gw_token');
    localStorage.removeItem('gw_user');
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    setToken(null);
    setUser(null);
  };

  const isImpersonating =
    Boolean(user?.impersonatedByAdmin) ||
    Boolean(localStorage.getItem(IMPERSONATION_STORAGE_KEY));

  const exitImpersonation = () => {
    try {
      const raw = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);

      if (raw) {
        const savedAdmin = JSON.parse(raw);
        if (savedAdmin?.token && savedAdmin?.user) {
          loginSuccess({
            token: savedAdmin.token,
            user: savedAdmin.user,
          });
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to restore admin session:', err);
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loginSuccess,
        logout,
        isImpersonating,
        exitImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}