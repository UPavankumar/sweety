import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { setThresholdsOwner } from '../lib/glucose';

const AuthContext = createContext(null);

function readSavedUser() {
  try {
    const saved = localStorage.getItem('sweety_user');
    const user = saved ? JSON.parse(saved) : null;
    setThresholdsOwner(user?.id);
    return user;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sweety_token'));
  const [user, setUser] = useState(readSavedUser);
  const [loading, setLoading] = useState(false);
  // Shown on the sign-in screen after a forced sign-out (e.g. expired session)
  const [sessionNotice, setSessionNotice] = useState('');

  const persist = (data) => {
    localStorage.setItem('sweety_token', data.token);
    localStorage.setItem('sweety_user', JSON.stringify(data.user));
    setThresholdsOwner(data.user.id);
    setToken(data.token);
    setUser(data.user);
    setSessionNotice('');
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await api.login(email, password);
      persist(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const data = await api.register(name, email, password);
      persist(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback((notice = '') => {
    localStorage.removeItem('sweety_token');
    localStorage.removeItem('sweety_user');
    setThresholdsOwner(null);
    setToken(null);
    setUser(null);
    setSessionNotice(typeof notice === 'string' ? notice : '');
  }, []);

  useEffect(() => {
    const onUnauthorized = () => logout('Your session has ended. Please sign in again.');
    window.addEventListener('sweety:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sweety:unauthorized', onUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token && !!user,
        loading,
        sessionNotice,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
