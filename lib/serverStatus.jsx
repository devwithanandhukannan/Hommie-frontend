'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onServerStatusChange } from '@/lib/api';

const ServerStatusContext = createContext({ isWakingUp: false, isBooting: false });

export function ServerStatusProvider({ children }) {
  const [status, setStatus] = useState({ isWakingUp: false, isBooting: false });

  useEffect(() => {
    return onServerStatusChange((next) => {
      setStatus({
        isWakingUp: Boolean(next?.isWakingUp),
        isBooting: Boolean(next?.isBooting),
      });
    });
  }, []);

  return (
    <ServerStatusContext.Provider value={status}>
      {children}
    </ServerStatusContext.Provider>
  );
}

export const useServerStatus = () => useContext(ServerStatusContext);
