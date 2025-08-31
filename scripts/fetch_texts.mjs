import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname); // scripts dir
const PROJECT_ROOT = path.resolve(ROOT, '..');
const STATIC_TEXTS_DIR = path.join(PROJECT_ROOT, 'static', 'texts');
const SOURCES_PATH = path.join(ROOT, 'texts-sources.json');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readSources() {
  const raw = await fs.readFile(SOURCES_PATH, 'utf8');
  return JSON.parse(raw);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed ${res.status}: ${url}`);
  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    const t = await res.text();
    try {
      return JSON.parse(t);
    } catch {
      throw new Error(`Non-JSON response (${ctype})`);
    }
  }
  return res.json();
}

function extractTitleFromSourceUrl(sourceUrl) {
  const u = new URL(sourceUrl);
  const last = decodeURIComponent(u.pathname.split('/').pop() || '');
  return last;
}

function buildCandidateTitles(source) {
  const t = extractTitleFromSourceUrl(source.sourceUrl) || source.title;
  const candidates = new Set();
  if (t) candidates.add(t);
  // Author/Title
  candidates.add(`${source.author}/${source.title}`);
  // Title（Author） with fullwidth parens
  candidates.add(`${source.title}（${source.author}）`);
  // Title (Author) halfwidth
  candidates.add(`${source.title} (${source.author})`);
  return Array.from(candidates);
}

async function fetchWikisourcePlainTextByTitle(title) {
  const api = new URL('https://zh.wikisource.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('prop', 'extracts');
  api.searchParams.set('explaintext', '1');
  api.searchParams.set('format', 'json');
  api.searchParams.set('redirects', '1');
  api.searchParams.set('titles', title);
  const data = await fetchJson(api.toString(), { headers: { 'accept-language': 'zh-TW' } });
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page || typeof page.extract !== 'string' || page.extract.length === 0) {
    throw new Error(`No extract for ${title}`);
  }
  return page.extract;
}

async function fetchWikisourceHtmlByTitle(title) {
  const api = new URL('https://zh.wikisource.org/w/api.php');
  api.searchParams.set('action', 'parse');
  api.searchParams.set('prop', 'text');
  api.searchParams.set('format', 'json');
  api.searchParams.set('redirects', '1');
  api.searchParams.set('formatversion', '2');
  api.searchParams.set('page', title);
  const data = await fetchJson(api.toString(), { headers: { 'accept-language': 'zh-TW' } });
  const html = data?.parse?.text;
  if (typeof html !== 'string' || html.length === 0) {
    throw new Error(`No HTML for ${title}`);
  }
  return html;
}

function decodeEntities(str) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };
  let out = str.replace(/&(amp|lt|gt|quot|#39);/g, (m) => entities[m] || m);
  // Numeric decimal
  out = out.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  // Numeric hex
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  return out;
}

function htmlToPlain(html) {
  let s = html;
  // Replace block tags with newlines to keep paragraphs
  s = s.replace(/<\s*br\s*\/?>/gi, '\n');
  s = s.replace(/<\s*\/p\s*>/gi, '\n');
  s = s.replace(/<\s*li\s*>/gi, '\n• ');
  s = s.replace(/<\s*\/h[1-6]\s*>/gi, '\n');
  s = s.replace(/<\s*\/tr\s*>/gi, '\n');
  // Remove all remaining tags
  s = s.replace(/<[^>]+>/g, '');
  // Decode entities
  s = decodeEntities(s);
  // Remove reference markers like [1]
  s = s.replace(/\[[0-9]+\]/g, '');
  // Collapse excessive blank lines
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

async function convertToTaiwanVariant(text) {
  // Chunk and POST to avoid 414 (URI too long)
  const chunks = chunkString(text, 1800);
  const out = [];
  for (const part of chunks) {
    const api = new URL('https://api.zhconvert.org/convert');
    const body = new URLSearchParams();
    body.set('converter', 'Taiwan');
    body.set('text', part);
    const data = await fetchJson(api.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    out.push(data?.data?.text ?? part);
    await sleep(120);
  }
  return out.join('');
}

function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

function sanitizeForFs(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

async function main() {
  await ensureDir(STATIC_TEXTS_DIR);
  const sources = await readSources();
  const metadata = [];

  for (const s of sources) {
    const candidates = buildCandidateTitles(s);
    let plain = null;
    let usedTitle = null;

    for (const cand of candidates) {
      try {
        // Try extracts (plain)
        plain = await fetchWikisourcePlainTextByTitle(cand);
        usedTitle = cand;
        break;
      } catch (e1) {
        // Try parse (HTML -> plain)
        try {
          const html = await fetchWikisourceHtmlByTitle(cand);
          plain = htmlToPlain(html);
          usedTitle = cand;
          break;
        } catch (e2) {
          // continue
        }
      }
      await sleep(120);
    }

    if (!plain) {
      console.error(`Failed: ${s.id} ${s.title}: no extract via candidates`);
      continue;
    }

    console.log(`Fetched: ${s.author}《${s.title}》 via ${usedTitle}`);

    try {
      const tc = await convertToTaiwanVariant(plain);
      const filename = sanitizeForFs(`${s.slug}.txt`);
      const outPath = path.join(STATIC_TEXTS_DIR, filename);
      await fs.writeFile(outPath, tc, 'utf8');
      metadata.push({
        id: s.id,
        slug: s.slug,
        title: s.title,
        author: s.author,
        sourceUrl: s.sourceUrl,
        license: s.license
      });
      console.log(`Saved: ${outPath}`);
      await sleep(200);
    } catch (e) {
      console.error(`Failed to save/convert: ${s.id} ${s.title}:`, e.message);
    }
  }

  const metaPath = path.join(STATIC_TEXTS_DIR, 'metadata.json');
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`Wrote metadata: ${metaPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
