// Minimal EPUB reader: unzip, follow the OPF spine, strip XHTML to paragraphs.
import JSZip from 'jszip';
import { bookFromText } from './split';
import type { BookData } from './types';

const decode = (s: string) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

export async function bookFromEpub(bytes: Uint8Array, fallbackTitle: string): Promise<BookData> {
  const zip = await JSZip.loadAsync(bytes);
  const container = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = container ? /full-path="([^"]+)"/.exec(container)?.[1] : undefined;
  if (!opfPath) throw new Error('Not a valid EPUB (no package file).');
  const opf = await zip.file(opfPath)?.async('string');
  if (!opf) throw new Error('Not a valid EPUB (package file missing).');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const title = decode(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opf)?.[1]?.trim() ?? fallbackTitle);
  const author = decode(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i.exec(opf)?.[1]?.trim() ?? 'Unknown');
  const manifest: Record<string, string> = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = /\bid="([^"]+)"/.exec(m[0])?.[1], href = /\bhref="([^"]+)"/.exec(m[0])?.[1];
    if (id && href) manifest[id] = decodeURIComponent(href);
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/gi)].map(m => manifest[m[1]]).filter(Boolean);
  const parts: string[] = [];
  for (const href of spine) {
    const file = zip.file(base + href) ?? zip.file(href);
    if (file) parts.push(htmlToText(await file.async('string')));
  }
  if (!parts.length) throw new Error('No readable text found in this EPUB.');
  return bookFromText(parts.join('\n\n'), title, author);
}
