'use client';
import { createContext, useContext } from 'react';

const ServerStatusContext = createContext({ isWakingUp: false });

export function ServerStatusProvider({ children }) {
  return children;
}

export const useServerStatus = () => useContext(ServerStatusContext);
