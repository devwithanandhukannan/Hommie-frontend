'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onServerStatusChange } from '@/lib/api';

const ServerStatusContext = createContext({ isWakingUp: false });

export function ServerStatusProvider({ children }) {
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [justConnected, setJustConnected] = useState(false);

  useEffect(() => {
    return onServerStatusChange((waking) => {
      if (waking) {
        setIsWakingUp(true);
        setJustConnected(false);
      } else {
        setIsWakingUp((prev) => {
          if (prev) {
            setJustConnected(true);
            setTimeout(() => setJustConnected(false), 2400);
          }
          return false;
        });
      }
    });
  }, []);

  return (
    <ServerStatusContext.Provider value={{ isWakingUp }}>
      {children}
      {isWakingUp || justConnected ? (
        <aside
          className={`server-wake-island ${justConnected ? 'connected' : 'waking'}`}
          role="status"
          aria-live="polite"
        >
          {justConnected ? (
            <div className="row center" style={{ gap: 10 }}>
              <span className="server-wake-check" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <div>
                <div className="bold small">Cloud Server Connected</div>
                <div className="tiny muted">Hommie is live and synced.</div>
              </div>
            </div>
          ) : (
            <div className="row center" style={{ gap: 12 }}>
              <div className="server-wake-pulse-ring">
                <span className="dot dot-1" />
                <span className="dot dot-2" />
                <span className="dot dot-3" />
              </div>
              <div>
                <div className="bold small" style={{ letterSpacing: -0.2 }}>
                  Waking up cloud server...
                </div>
                <div className="tiny muted">
                  Please hold on.
                </div>
              </div>
            </div>
          )}
        </aside>
      ) : null}
    </ServerStatusContext.Provider>
  );
}

export const useServerStatus = () => useContext(ServerStatusContext);
