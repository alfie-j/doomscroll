// Native data layer: SQLite. A kv table holds the app state as JSON; an events table keeps the
// raw interaction log used for stats and weekly tuning. Swap this file to add sync later.
import * as SQLite from 'expo-sqlite';
import type { LogEvent, PersistedState } from '../engine/state';

export interface Store {
  load(): Promise<unknown | null>;
  save(state: PersistedState): Promise<void>;
  log(events: LogEvent[]): Promise<void>;
  events(since: number): Promise<LogEvent[]>;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function db() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('mindscroll.db').then(async d => {
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, type TEXT NOT NULL,
          card_id TEXT, subject TEXT, format TEXT, dwell INTEGER, value REAL);
        CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
      `);
      return d;
    });
  }
  return dbPromise;
}

export const store: Store = {
  async load() {
    const d = await db();
    const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', ['state']);
    return row ? JSON.parse(row.value) : null;
  },
  async save(state) {
    const d = await db();
    await d.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', ['state', JSON.stringify(state)]);
  },
  async log(events) {
    if (!events.length) return;
    const d = await db();
    await d.withTransactionAsync(async () => {
      for (const e of events) {
        await d.runAsync(
          'INSERT INTO events (ts, type, card_id, subject, format, dwell, value) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [e.ts, e.type, e.cardId ?? null, e.subject ?? null, e.format ?? null, e.dwell ?? null, e.value ?? null],
        );
      }
    });
  },
  async events(since) {
    const d = await db();
    const rows = await d.getAllAsync<{ ts: number; type: LogEvent['type']; card_id: string | null; subject: string | null; format: string | null; dwell: number | null; value: number | null }>(
      'SELECT ts, type, card_id, subject, format, dwell, value FROM events WHERE ts >= ? ORDER BY ts', [since]);
    return rows.map(r => ({ ts: r.ts, type: r.type, cardId: r.card_id ?? undefined, subject: r.subject ?? undefined, format: r.format ?? undefined, dwell: r.dwell ?? undefined, value: r.value ?? undefined }));
  },
};
