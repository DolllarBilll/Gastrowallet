import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

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
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loginSuccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}