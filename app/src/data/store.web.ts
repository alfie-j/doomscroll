// Web data layer (used for browser previews): localStorage, same interface as the SQLite store.
import type { LogEvent, PersistedState } from '../engine/state';
import type { Store } from './store';

const K_STATE = 'mindscroll:state';
const K_EVENTS = 'mindscroll:events';
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage full or blocked */ } };

export const store: Store = {
  async load() { const v = get(K_STATE); return v ? JSON.parse(v) : null; },
  async save(state: PersistedState) { set(K_STATE, JSON.stringify(state)); },
  async log(events: LogEvent[]) {
    if (!events.length) return;
    const all: LogEvent[] = JSON.parse(get(K_EVENTS) ?? '[]');
    set(K_EVENTS, JSON.stringify([...all, ...events].slice(-5000)));
  },
  async saveBlob(key: string, value: string) {
    try { localStorage.setItem(`mindscroll:blob:${key}`, value); } catch { throw new Error('Not enough browser storage for this book.'); }
  },
  async loadBlob(key: string) { return get(`mindscroll:blob:${key}`); },
  async deleteBlob(key: string) { try { localStorage.removeItem(`mindscroll:blob:${key}`); } catch { /* ignore */ } },
  async events(since: number) {
    const all: LogEvent[] = JSON.parse(get(K_EVENTS) ?? '[]');
    return all.filter(e => e.ts >= since);
  },
};
