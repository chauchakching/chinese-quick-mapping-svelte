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
const SPLIT_LONG_SENTENCE_THRESHOLD = 80; // further split long sentences by comma
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
  // ratio of Han (and CJK punct) to total after filtering should be high
  const hanRe = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
  const total = filtered.length || 1;
  const hanCount = (filtered.match(hanRe) || []).length;
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
  for (const s of sentences) {
    let t = s.replace(/\s+/g, '');
    // Ensure starts with Han: trim leading non-Han, then check
    t = trimLeadingNonHan(t);
    if (!t || !HAN_CHAR_RE.test(t[0])) continue;
    if (t.length >= minLen && t.length <= maxLen) out.push(t);
  }
  return out;
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}

async function build() {
  const metaRaw = await fs.readFile(METADATA_PATH, 'utf8');
  const metadata = JSON.parse(metaRaw);

  const files = await fs.readdir(STATIC_TEXTS_DIR);
  const textFiles = files.filter((f) => f.endsWith('.txt'));

  let snippets = [];

  for (const tf of textFiles) {
    const full = await fs.readFile(path.join(STATIC_TEXTS_DIR, tf), 'utf8');
    const norm = normalizeWhitespace(full);
    const hanOnly = keepMostlyHan(norm);
    if (!hanOnly) continue;
    const sentences = splitIntoSentences(hanOnly);
    const bounded = windowByLength(sentences);
    snippets = snippets.concat(bounded);
  }

  const unique = dedupe(snippets);
  // Shuffle for variety
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  const payload = {
    createdAt: new Date().toISOString(),
    sourceCount: textFiles.length,
    snippetCount: unique.length,
    minLen: MIN_SNIPPET_LEN,
    maxLen: MAX_SNIPPET_LEN,
    snippets: unique
  };

  await fs.writeFile(SNIPPETS_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${unique.length} snippets to ${SNIPPETS_PATH}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
