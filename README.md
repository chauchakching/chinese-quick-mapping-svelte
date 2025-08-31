# chinese-quick-mapping

速成查字

https://速成查字.xyz

A static svelteki-kit app to search keystrokes of chinese keyboard input methods 速成 (Quick) and 倉頡 (Cangjie IME).

Revamped from the [Elm version](https://github.com/chauchakching/chinese-quick-mapping).

## Getting Started

```bash
# install dependencies
npm install

# start dev server
npm run dev
```

A dev server will be started on `localhost:3000`

## Running Cypress tests

After dev server started, run `npm run cypress` to run tests in terminal, or `npx cypress open` to open the test runner

## Build

```sh
npm run build
```

## Production preview

```sh
npm run build && npm run preview
```

## Typing practice texts and snippets

This project now includes a full‑text corpus (Traditional Chinese) and a snippets generator for the typing exercise page (`/typing`).

- Corpus lives under `static/texts/`
  - `<slug>.txt` — full text (UTF‑8, 繁體)
  - `metadata.json` — { id, slug, title, author, sourceUrl, license }
  - `snippets.json` — small, similar‑length snippets used by the typing page

### Populate texts (Public Domain/CC sources)

- Configure sources in `scripts/texts-sources.json`
- Fetch and normalize (includes conversion to Taiwan variant):

```bash
npm run fetch:texts
```

This writes full texts and updates `static/texts/metadata.json`.

### Build snippets

- Generate uniformly sized snippets (mostly漢字, start with漢字, deduped/shuffled):

```bash
npm run build:snippets
```

Outputs `static/texts/snippets.json` (normalized) with fields:

```json
{
  "createdAt": "ISO-8601",
  "sourceCount": 7,
  "snippetCount": 100,
  "minLen": 28,
  "maxLen": 68,
  "sources": [
    {
      "id": "luxun-kongyiji",
      "slug": "魯迅_孔乙己",
      "title": "孔乙己",
      "author": "魯迅",
      "sourceUrl": "...",
      "license": "...",
      "snippetCount": 123
    }
  ],
  "snippets": [["……", 0]]
}
```

Notes:

- `snippets` is an array of `[text, sourceIndex]` tuples referencing `sources`.
- `sources[i].snippetCount` shows how many snippets came from that source.

### Using snippets in the app

- Visit `/typing`.
- The page loads the normalized `static/texts/snippets.json` and requires this schema.
- It keeps an in‑memory shuffled pool and avoids reuse until all snippets are seen, then reshuffles.
