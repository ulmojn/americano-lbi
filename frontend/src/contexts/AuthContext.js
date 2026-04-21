import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (!token) { setVerified(true); return; }
    axios.get(`${API}/api/admin/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => setVerified(true))
      .catch(() => {
        localStorage.removeItem('admin_token');
        setToken(null);
        setVerified(true);
      });
  }, [token]);

  const login = (newToken) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  if (!verified) return null;

  return (
    <AuthContext.Provider value={{ token, isAdmin: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
