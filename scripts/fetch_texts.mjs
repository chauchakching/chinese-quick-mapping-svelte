import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname); // scripts dir
const PROJECT_ROOT = path.resolve(ROOT, '..');
const STATIC_TEXTS_DIR = path.join(PROJECT_ROOT, 'static', 'texts');
const HTML_CACHE_DIR = path.join(PROJECT_ROOT, 'html-cache');
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
  // Check cache first
  const cachedHtml = await getCachedHtml(title);
  if (cachedHtml) {
    return extractMainContent(cachedHtml);
  }

  // Fetch from API if not cached
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

  // Save to cache for future use
  await saveHtmlToCache(title, html);

  return extractMainContent(html);
}

function extractMainContent(html) {
  // Don't pre-filter HTML content here - let htmlToPlain handle the filtering
  // The HTML from Wikisource API already contains mainly the content area
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
  // First, remove problematic elements that contain licensing/metadata
  let s = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gis, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gis, '')
    .replace(/<link[^>]*href="mw-data:TemplateStyles[^"]*"[^>]*>/gis, '')
    .replace(/<div[^>]*class="[^"]*licenseContainer[^"]*"[^>]*>[\s\S]*?<\/div>/gis, '')
    .replace(/<div[^>]*class="[^"]*licensetpl[^"]*"[^>]*>[\s\S]*?<\/div>/gis, '');

  // Extract article metadata from Wikisource header structure
  let title = '';
  let author = '';
  let date = '';

  // Look for title in headerContainer table structure
  const headerMatch = s.match(/<div id="headerContainer">[\s\S]*?<\/table>/i);
  if (headerMatch) {
    const headerContent = headerMatch[0];

    // Extract title (usually in <b> tags)
    const titleMatch = headerContent.match(/<b>([^<]+)<\/b>/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract author (after "作者：" text)
    const authorMatch = headerContent.match(/作者[：:].*?title="Author:[^"]*">([^<]+)<\/a>/i);
    if (authorMatch) {
      author = `作者：${authorMatch[1].trim()}`;
    }

    // Extract date
    const dateMatch = headerContent.match(/(\d{4}年\d{1,2}月(?:\d{1,2}日)?)/);
    if (dateMatch) {
      date = dateMatch[1];
    }
  }

  // Extract main content from paragraph elements only
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = pRegex.exec(s)) !== null) {
    let pContent = match[1];

    // Skip paragraphs that contain metadata/navigation/licensing markers
    if (
      pContent.match(
        /(姊妹計劃|此版本取自|本作品收錄於|數據項|百科|粵典|←|→|\d{4}年\d+月\d+日.*?公有領域|這部作品.*?公有領域|本作品現時在大中華|根據.*?著作權法|據.*?著作權法釋義|魯迅全集.*?出版)/
      )
    ) {
      continue;
    }

    // Remove HTML tags and decode entities
    pContent = pContent
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\[[0-9]+\]/g, '') // Remove reference markers
      .replace(/\[編輯\]/g, '') // Remove edit markers
      .trim();

    // Skip empty or very short paragraphs
    if (pContent.length < 15) {
      continue;
    }

    paragraphs.push(pContent);
  }

  // Combine metadata and content
  const parts = [];
  if (title) parts.push(title);
  if (author) parts.push(author);
  if (date) parts.push(date);
  if (parts.length > 0) parts.push(''); // Add blank line after metadata
  parts.push(...paragraphs);

  return parts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive blank lines
    .replace(/[ \t]+/g, ' ') // Collapse multiple spaces
    .trim();
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

async function getCachedHtml(title) {
  const filename = sanitizeForFs(title) + '.html';
  const cacheFile = path.join(HTML_CACHE_DIR, filename);
  try {
    const html = await fs.readFile(cacheFile, 'utf8');
    console.log(`Using cached HTML: ${filename}`);
    return html;
  } catch {
    return null; // Cache miss
  }
}

async function saveHtmlToCache(title, html) {
  await ensureDir(HTML_CACHE_DIR);
  const filename = sanitizeForFs(title) + '.html';
  const cacheFile = path.join(HTML_CACHE_DIR, filename);
  await fs.writeFile(cacheFile, html, 'utf8');
  console.log(`Cached HTML: ${filename}`);
}

async function processSource(source, semaphore) {
  // Acquire semaphore for rate limiting
  await semaphore.acquire();

  try {
    const candidates = buildCandidateTitles(source);
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
      console.error(`Failed: ${source.id} ${source.title}: no extract via candidates`);
      return null;
    }

    console.log(`Fetched: ${source.author}《${source.title}》 via ${usedTitle}`);

    try {
      const tc = await convertToTaiwanVariant(plain);
      const filename = sanitizeForFs(`${source.slug}.txt`);
      const outPath = path.join(STATIC_TEXTS_DIR, filename);
      await fs.writeFile(outPath, tc, 'utf8');
      console.log(`Saved: ${outPath}`);

      return {
        id: source.id,
        slug: source.slug,
        title: source.title,
        author: source.author,
        sourceUrl: source.sourceUrl,
        license: source.license
      };
    } catch (e) {
      console.error(`Failed to save/convert: ${source.id} ${source.title}:`, e.message);
      return null;
    }
  } finally {
    // Release semaphore after a delay to respect API limits
    setTimeout(() => semaphore.release(), 200);
  }
}

// Simple semaphore implementation for concurrency control
class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.current < this.maxConcurrent) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const next = this.queue.shift();
      next();
    }
  }
}

async function main() {
  await ensureDir(STATIC_TEXTS_DIR);
  const sources = await readSources();

  // Create semaphore to limit concurrent requests (max 3 concurrent)
  const semaphore = new Semaphore(3);

  console.log(`Processing ${sources.length} sources in parallel...`);

  // Process all sources in parallel
  const promises = sources.map((source) => processSource(source, semaphore));
  const results = await Promise.all(promises);

  // Filter out failed results and build metadata
  const metadata = results.filter((result) => result !== null);

  const metaPath = path.join(STATIC_TEXTS_DIR, 'metadata.json');
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`Wrote metadata: ${metaPath} (${metadata.length}/${sources.length} successful)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
