# Text corpus (Traditional Chinese)

Purpose: store full-text articles (modern prose/novellas) in Traditional Chinese for typing practice. Snippets are derived at build-time, but full texts are kept so the extraction algorithm can evolve safely.

Directory layout:

- `<slug>.txt` — full text, UTF‑8, Traditional Chinese
- `metadata.json` — array of { id, slug, title, author, sourceUrl, license }
- `snippets.json` — generated pool used by the typing page

Populate texts:

- Configure sources in `scripts/texts-sources.json`
- Fetch full texts (from zh.wikisource.org) and normalize to 繁體（臺灣）:
  ```bash
  npm run fetch:texts
  ```

Build snippets:

- Generate `snippets.json` from all `.txt` files:
  ```bash
  npm run build:snippets
  ```
- Current rules (see `scripts/build_snippets.mjs`):
  - Normalize whitespace
  - Keep mostly Chinese characters (Han ratio ≥ 0.85) and allowed CJK punctuation
  - Each snippet must start with a Chinese character
  - Target length 28–68 characters (inclusive)
  - Split long sentences by `，` if needed, keep clauses ≥ 16 chars
  - Deduplicate and shuffle for variety

Runtime usage:

- The typing page `src/routes/typing/+page.svelte` fetches `/texts/snippets.json` on the client and keeps a shuffled pool of unseen indices to avoid reuse until all snippets are seen (then reshuffles).

Licensing & attribution:

- Prefer Public Domain (PD) works. Some Wikisource pages may be CC BY‑SA; if used, keep attribution (author, page URL) and comply with share‑alike when redistributing.
- Record source and license in `metadata.json` for every entry.

Updating content:

- Add new entries to `scripts/texts-sources.json`, then run:
  ```bash
  npm run fetch:texts && npm run build:snippets
  ```
  Commit updated `.txt`, `metadata.json`, and `snippets.json`.
