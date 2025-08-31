# Text corpus (Traditional Chinese)

Purpose: store full-text articles (modern prose/novellas) in Traditional Chinese for typing practice. Snippets are derived at runtime or build-time, but the full texts are kept to allow future changes in extraction logic.

Structure:

- texts/
  - <slug>.txt — full text, UTF-8, Traditional Chinese
  - metadata.json — array of items with { id, slug, title, author, sourceUrl, license }

Licensing:

- Prefer public domain (PD) works. Some wiki pages may be CC BY-SA; if used, keep attribution (author, page URL) and share-alike if redistributed.
- Verify each entry in metadata.json for license notes.

Population:

- Use scripts/fetch_texts.mjs with scripts/texts-sources.json to fetch from zh.wikisource.org and save to this folder.
