'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onServerStatusChange } from '@/lib/api';

const ServerStatusContext = createContext({ isWakingUp: false });

export function ServerStatusProvider({ children }) {
  const [isWakingUp, setIsWakingUp] = useState(false);

  useEffect(() => {
    return onServerStatusChange((state) => setIsWakingUp(Boolean(state?.isWakingUp)));
  }, []);

  return (
    <ServerStatusContext.Provider value={{ isWakingUp }}>
      {children}
    </ServerStatusContext.Provider>
  );
}

export const useServerStatus = () => useContext(ServerStatusContext);
