import React, { createContext, useContext, useSyncExternalStore } from 'react';
import type { Engine } from '../engine/engine';
import type { Theme } from '../theme';

interface Ctx {
  engine: Engine;
  theme: Theme;
  /** Cards report taps/answers so the feed knows the user engaged. */
  markInteracted: (itemKey: string) => void;
  toast: (text: string) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

/** Re-renders when the engine changes. */
export function useEngineVersion(engine: Engine): number {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
}
