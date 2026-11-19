// The reading library: bundled public-domain books plus books the user imports.
// Book text is kept out of the main state; only progress lives there.
import * as DocumentPicker from 'expo-document-picker';
import { BUNDLED_BOOKS } from '../content/books';
import { store } from '../data/store';
import type { Engine } from '../engine/engine';
import { bookFromEpub } from './epub';
import { readBytes, readText } from './readFile';
import { bookFromText, guessTitleAuthor } from './split';
import type { BookData } from './types';

const cache = new Map<string, BookData>();

export function cachedBook(id: string): BookData | undefined { return cache.get(id); }

export async function loadBook(id: string): Promise<BookData | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const bundled = BUNDLED_BOOKS.find(b => b.id === id);
  let book: BookData | null = null;
  if (bundled) book = bundled.load();
  else {
    const raw = await store.loadBlob(`book:${id}`);
    book = raw ? (JSON.parse(raw) as BookData) : null;
  }
  if (book) cache.set(id, book);
  return book;
}

/** Makes a book the one you're reading. Returns false if its text couldn't be found. */
export async function openBook(engine: Engine, id: string): Promise<boolean> {
  const book = await loadBook(id);
  if (!book) return false;
  engine.setReading(book, !BUNDLED_BOOKS.some(b => b.id === id));
  return true;
}

/** Lets the user pick a .txt or .epub file, splits it into bites and starts reading it. */
export async function importBook(engine: Engine): Promise<{ ok: true; title: string; bites: number } | { ok: false; error?: string }> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'application/epub+zip', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return { ok: false };
  const a = res.assets[0];
  try {
    const isEpub = /\.epub$/i.test(a.name) || a.mimeType === 'application/epub+zip';
    let book: BookData;
    if (isEpub) book = await bookFromEpub(await readBytes(a.uri), a.name.replace(/\.epub$/i, ''));
    else {
      const text = await readText(a.uri);
      const { title, author } = guessTitleAuthor(text, a.name);
      book = bookFromText(text, title, author);
    }
    if (book.bites.length < 3) return { ok: false, error: 'Couldn’t find enough text in that file.' };
    await store.saveBlob(`book:${book.id}`, JSON.stringify(book));
    cache.set(book.id, book);
    engine.setReading(book, true);
    return { ok: true, title: book.title, bites: book.bites.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'That file couldn’t be read.' };
  }
}

export async function deleteBook(engine: Engine, id: string) {
  engine.removeBook(id);
  cache.delete(id);
  await store.deleteBlob(`book:${id}`).catch(() => {});
}
