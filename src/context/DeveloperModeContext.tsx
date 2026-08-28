import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface UnlockOutcome {
  ok: boolean;
  error?: string;
}

interface DeveloperModeValue {
  /** True while a server-issued token is held and unexpired. */
  unlocked: boolean;
  /** Headers to attach to a request that needs developer rights. Empty when locked. */
  authHeaders: () => Record<string, string>;
  unlock: (password: string) => Promise<UnlockOutcome>;
  lock: () => void;
}

const DeveloperModeContext = createContext<DeveloperModeValue | undefined>(undefined);

/**
 * Holds Developer Mode authorization for the current page session.
 *
 * The token lives in memory and nowhere else — not localStorage, not
 * sessionStorage, not a cookie — so closing the tab ends Developer Mode and
 * nothing durable on the machine records that it was ever unlocked. The
 * password is posted once and never kept at all: only the server's short-lived
 * signed token comes back, and it is the server that decides what it unlocks.
 */
export const DeveloperModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tokenRef = useRef<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    tokenRef.current = null;
    setUnlocked(false);
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = null;
  }, []);

  useEffect(() => () => { if (expiryTimer.current) clearTimeout(expiryTimer.current); }, []);

  const unlock = useCallback(
    async (password: string): Promise<UnlockOutcome> => {
      let res: Response;
      try {
        res = await fetch("/api/developer/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
      } catch {
        return { ok: false, error: "Could not reach the server. Check your connection and try again." };
      }
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.token) {
        return { ok: false, error: data?.error || `Unlock failed (HTTP ${res.status}).` };
      }
      tokenRef.current = data.token;
      setUnlocked(true);
      // Drop the token the moment the server would stop honouring it, so the UI
      // never claims an unlock that the backend has already let expire.
      const ttl = Number(data.expiresAt) - Date.now();
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      if (Number.isFinite(ttl) && ttl > 0) expiryTimer.current = setTimeout(lock, ttl);
      return { ok: true };
    },
    [lock]
  );

  const authHeaders = useCallback(
    () => (tokenRef.current ? { "X-Developer-Token": tokenRef.current } : {}),
    []
  );

  const value = useMemo<DeveloperModeValue>(() => ({ unlocked, authHeaders, unlock, lock }), [unlocked, authHeaders, unlock, lock]);
  return <DeveloperModeContext.Provider value={value}>{children}</DeveloperModeContext.Provider>;
};

export function useDeveloperMode(): DeveloperModeValue {
  const context = useContext(DeveloperModeContext);
  if (!context) throw new Error("useDeveloperMode must be used inside a DeveloperModeProvider");
  return context;
}
