import fs from 'node:fs/promises';
import path from 'node:path';

// Paths
const PROJECT_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const STATIC_TEXTS_DIR = path.join(PROJECT_ROOT, 'static', 'texts');
const SNIPPETS_PATH = path.join(STATIC_TEXTS_DIR, 'snippets.json');
const METADATA_PATH = path.join(STATIC_TEXTS_DIR, 'metadata.json');

// Snippet generation constants
const MIN_SNIPPET_LEN = 28; // inclusive
const MAX_SNIPPET_LEN = 68; // inclusive
const HAN_RATIO_THRESHOLD = 0.85; // proportion of Han chars (after filtering)
const SPLIT_LONG_SENTENCE_THRESHOLD = MAX_SNIPPET_LEN; // further split long sentences by comma when over max length
const MIN_CLAUSE_LEN = 16; // when splitting by comma, keep clauses >= this length

// Allowed punctuation for Chinese sentences
const CH_PUNCT = '，。！？、；：「」『』（）《》〈〉—…·．「」﹁﹂（）、——';
const HAN_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;

function normalizeWhitespace(text) {
  return text
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\s*\n+\s*/g, '\n')
    .trim();
}

function keepMostlyHan(text) {
  const allowed = new RegExp(`[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF${CH_PUNCT}\s]`, 'u');
  const filtered = Array.from(text)
    .filter((ch) => allowed.test(ch))
    .join('');
  // Compute ratio ignoring whitespace and common CJK punctuation (we show but don't require typing them)
  const hanRe = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
  const punctRe = new RegExp(`[${CH_PUNCT}]`, 'g');
  const base = filtered.replace(/\s+/g, '').replace(punctRe, '');
  const total = base.length || 1;
  const hanCount = (base.match(hanRe) || []).length;
  const ratio = hanCount / total;
  return ratio >= HAN_RATIO_THRESHOLD ? filtered : '';
}

function splitIntoSentences(text) {
  // Split by Chinese sentence terminators and keep them
  const parts = text
    .replace(/([。！？；])/g, '$1\n')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Also break long clauses further by comma if needed
  const refined = [];
  for (const p of parts) {
    if (p.length > SPLIT_LONG_SENTENCE_THRESHOLD) {
      const clauses = p.split(/，/).map((c) => (c.endsWith('，') ? c : c + '，'));
      for (const c of clauses) {
        if (c.length >= MIN_CLAUSE_LEN) refined.push(c.replace(/，$/, '。'));
      }
    } else {
      refined.push(p);
    }
  }
  return refined;
}

function trimLeadingNonHan(text) {
  return text.replace(/^[^\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/u, '');
}

function windowByLength(sentences, minLen = MIN_SNIPPET_LEN, maxLen = MAX_SNIPPET_LEN) {
  const out = [];
  for (let i = 0; i < sentences.length; i++) {
    let acc = '';
    for (let j = i; j < sentences.length; j++) {
      let t = sentences[j].replace(/\s+/g, '');
      // Ensure starts with Han: trim leading non-Han, then check
      t = trimLeadingNonHan(t);
      if (!t || !HAN_CHAR_RE.test(t[0])) continue;

      const candidate = acc + t;
      if (candidate.length > maxLen) {
        if (acc && acc.length >= minLen) out.push(acc);
        break;
      }

      acc = candidate;
      if (acc.length >= minLen && acc.length <= maxLen) {
        out.push(acc);
        break; // move start window forward
      }
    }
  }
  return out;
}

async function build() {
  const metaRaw = await fs.readFile(METADATA_PATH, 'utf8');
  const metadata = JSON.parse(metaRaw);

  const files = await fs.readdir(STATIC_TEXTS_DIR);
  const textFiles = files.filter((f) => f.endsWith('.txt'));

  let snippets = [];

  // Build sources list from available text files (preserve file order)
  const sources = textFiles.map((tf) => {
    const slug = path.basename(tf, '.txt');
    const m = Array.isArray(metadata) ? metadata.find((x) => x && x.slug === slug) : undefined;
    return {
      id: m?.id || slug,
      slug,
      title: m?.title || '',
      author: m?.author || '',
      sourceUrl: m?.sourceUrl || '',
      license: m?.license || ''
    };
  });

  for (let i = 0; i < textFiles.length; i++) {
    const tf = textFiles[i];
    const full = await fs.readFile(path.join(STATIC_TEXTS_DIR, tf), 'utf8');
    const norm = normalizeWhitespace(full);
    const hanOnly = keepMostlyHan(norm);
    if (!hanOnly) continue;
    const sentences = splitIntoSentences(hanOnly);
    const bounded = windowByLength(sentences);

    // Create normalized tuples: [text, sourceIndex]
    const tuples = bounded.map((text) => [text, i]);
    snippets = snippets.concat(tuples);
  }

  // Dedupe by text content, keep first seen tuple
  const byText = new Map();
  for (const s of snippets) {
    const key = Array.isArray(s) ? s[0] : typeof s === 'string' ? s : s.text;
    if (!byText.has(key)) byText.set(key, s);
  }
  /** @type {Array<[string, number]>} */
  const unique = Array.from(byText.values()).map((v) => {
    if (Array.isArray(v)) return /** @type {[string, number]} */ (v);
    if (typeof v === 'string') return [v, 0];
    return [
      v.text,
      Math.max(
        0,
        sources.findIndex((s) => s.slug === v.slug)
      )
    ];
  });
  // Shuffle for variety
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  // Compute per-source counts
  const sourceCounts = Array.from({ length: sources.length }, () => 0);
  for (const [_, idx] of unique) {
    if (Number.isInteger(idx) && idx >= 0 && idx < sourceCounts.length) {
      sourceCounts[idx] += 1;
    }
  }

  // Merge counts into sources
  const sourcesWithCounts = sources.map((s, i) => ({ ...s, snippetCount: sourceCounts[i] }));

  const payload = {
    createdAt: new Date().toISOString(),
    sourceCount: sources.length,
    snippetCount: unique.length,
    minLen: MIN_SNIPPET_LEN,
    maxLen: MAX_SNIPPET_LEN,
    sources: sourcesWithCounts,
    snippets: unique
  };

  await fs.writeFile(SNIPPETS_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${unique.length} snippets to ${SNIPPETS_PATH}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
