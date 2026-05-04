import React, { createContext, useContext, useEffect, useState } from 'react';
import { Api, loadConfig, setToken, setUser, clearAuth, getApiBase } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [user, setUserState] = useState(null);
  const [apiBase, setBaseState] = useState(null);

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig();
      setBaseState(cfg.base);
      if (cfg.base && cfg.token) {
        try {
          const me = await Api.me();
          setUserState(me);
        } catch {
          await clearAuth();
        }
      }
      setBooting(false);
    })();
  }, []);

  const login = async (username, password) => {
    const data = await Api.login(username, password);
    await setToken(data.token);
    await setUser(data.user);
    setUserState(data.user);
    return data.user;
  };

  const logout = async () => {
    await Api.logout();
    await clearAuth();
    setUserState(null);
  };

  const updateBase = (b) => setBaseState(b);

  return (
    <AuthCtx.Provider value={{ booting, user, apiBase, login, logout, updateBase, apiBaseGetter: getApiBase }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
