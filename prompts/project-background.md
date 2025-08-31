## Project background: Chinese Quick Mapping (Svelte)

Use this at the start of every conversation to stay aligned with the project’s intent and constraints.

### What this is

- **Purpose**: A website for checking Traditional Chinese 速成 (Quick) and 倉頡 (Cangjie) character parts and keyboard codes, plus typing practice.
- **Scope**: Reference, visualization, and typing practice tool (not an input method editor). Client-only, offline-capable PWA.

### Core capabilities

- **Lookup**: Search Traditional Chinese characters to show 速成/倉頡 codes.
- **Decomposition**: Visualize character components/parts and their mapping to keys.
- **Typing Practice**: Test Chinese typing skills with curated text snippets, real-time CPM/accuracy tracking, and IME-friendly input handling.
- **Assets**: Per-character SVGs and mapping JSONs, cached for offline use.

### Tech stack

- **Frontend**: SvelteKit + Vite, TypeScript, Tailwind CSS.
- **PWA**: `static/service-worker.js` for caching assets and offline functionality.
- **Testing**: Cypress e2e (`cypress/e2e/sanity.cy.ts`, `cypress/e2e/typing.cy.ts`).
- **Hosting model**: Static site; no backend services.

### Key data and assets

- **Mappings**:
  - `static/assets/ChineseQuickMapping.json`
  - `src/lib/ChineseQuickMappingSmall.json`
- **Frequencies/metadata**:
  - `ranks.json`
  - `src/lib/chars-with-images.json`
- **Character SVGs**:
  - `static/chars/*.svg` (~39k files)
- **Typing Practice Texts**:
  - `static/texts/*.txt` (7 source texts)
  - `static/texts/snippets.json` (normalized: sources[] with per-source snippetCount, and snippets as `[text, sourceIndex]` tuples; 28–68 chars)
  - `static/texts/metadata.json` (text metadata and attribution)

### Folder structure

```
/
├─ cypress/
│  ├─ e2e/                      # End-to-end tests (sanity, typing flows)
│  ├─ fixtures/                 # Test fixtures
│  ├─ support/                  # Cypress support files
│  └─ tsconfig.json
├─ prompts/
│  └─ project-background.md     # This document
├─ scripts/                     # Data generation and scraping scripts
│  ├─ build_snippets.mjs
│  ├─ fetch_texts.mjs
│  ├─ generate-small-mapping.js
│  ├─ get-chars-with-chinese-images.js
│  ├─ scrap-all-cangjie-mappings.js
│  └─ scrap-frequent-chinese-characters.js
├─ src/
│  ├─ app.css
│  ├─ app.d.ts
│  ├─ app.html
│  ├─ lib/
│  │  ├─ CharDecompositionGraph.svelte
│  │  ├─ Message.svelte
│  │  ├─ Modal.svelte
│  │  ├─ Navigation.svelte
│  │  ├─ keyToQuickUnit.ts      # Quick unit mapping logic
│  │  ├─ types.ts               # Shared TypeScript types
│  │  ├─ utils.ts               # Shared utilities
│  │  ├─ utils.test.ts          # Unit tests for utils
│  │  ├─ chars-with-images.json # Metadata used by UI
│  │  └─ ChineseQuickMappingSmall.json
│  └─ routes/
│     ├─ +layout.svelte         # App layout
│     ├─ +page.svelte           # Main lookup UI
│     ├─ +page.js               # Page load/data for main
│     └─ typing/
│        └─ +page.svelte        # Typing practice UI
├─ static/
│  ├─ assets/                   # Mapping and image assets
│  ├─ icons/
│  ├─ manifest.webmanifest
│  ├─ robots.txt
│  ├─ service-worker.js         # PWA cache logic
│  └─ texts/                    # Source texts, snippets, metadata
├─ ranks.json                   # Frequency/metadata
├─ svelte.config.js
├─ tailwind.config.cjs
├─ tsconfig.json
└─ vite.config.ts
```

### Important files/directories

- **UI**: `src/routes/+page.svelte` (main lookup), `src/routes/typing/+page.svelte` (typing practice), `src/routes/+layout.svelte`
- **Components**: `src/lib/CharDecompositionGraph.svelte`, `src/lib/Message.svelte`, `src/lib/Modal.svelte`
- **Logic/Types**: `src/lib/keyToQuickUnit.ts`, `src/lib/types.ts`, `src/lib/utils.ts`
- **PWA**: `static/service-worker.js`, `static/manifest.webmanifest`
- **Scripts**: `scripts/generate-small-mapping.js`, `scripts/get-chars-with-chinese-images.js`, `scripts/scrap-*`, `scripts/fetch_texts.mjs`, `scripts/build_snippets.mjs`
- **Tests**: `cypress/e2e/sanity.cy.ts`

### Conventions and constraints

- **Traditional-first**: All lookups assume Traditional Chinese characters.
- **Terminology**: 速成 = Quick; 倉頡 = Cangjie; “character parts” are components used by these methods.
- **Mobile-first**: ~90% of traffic is from mobile; prioritize responsive UI, touch-friendly interactions, and fast loads on low-end devices.
- **Performance**: Prefer static asset fetching and caching; avoid heavy runtime computation or importing large asset sets at build time.
- **Offline**: Keep features functional with cached assets; mind service worker behavior.
- **Client-only**: No server backend assumed.

### Typical changes to expect

- Improve search and mapping accuracy; add or correct Quick/Cangjie codes.
- Enhance decomposition visuals and UX in `+page.svelte` and `CharDecompositionGraph.svelte`.
- Expand typing practice: add new text sources, adjust snippet extraction rules, improve typing algorithm.
- Optimize asset loading/caching strategies and service worker updates.
- Update Cypress tests when UI/flows change.

### Non-goals

- Not an IME/keyboard; purely a reference, visualization, and typing practice tool.
- Not focused on Simplified Chinese unless explicitly requested.
- Avoid server-side components unless requirements change.

### Agent interaction style

- Be concise and technical. Reference concrete file paths like `src/lib/...`.
- Prefer minimal, safe edits with clear diffs. Verify against mapping JSONs when in doubt.
- Consider offline behavior and caching whenever changing asset paths or fetch logic.
- **Dev server**: During conversations, assume the local SvelteKit dev server is running (usually `http://localhost:3000`). Verify by checking port 3000 if needed.
- Respect folder structure: place shared helpers in `src/lib/utils.ts` (and tests in `src/lib/utils.test.ts`), shared types in `src/lib/types.ts`, Quick/Cangjie unit logic in `src/lib/keyToQuickUnit.ts`, and page-specific logic under `src/routes/**`. Do not duplicate utilities inside `routes/`.
