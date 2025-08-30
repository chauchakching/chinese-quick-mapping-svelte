## Project background: Chinese Quick Mapping (Svelte)

Use this at the start of every conversation to stay aligned with the project’s intent and constraints.

### What this is

- **Purpose**: A website for checking Traditional Chinese 速成 (Quick) and 倉頡 (Cangjie) character parts and keyboard codes.
- **Scope**: Reference and visualization tool (not an input method editor). Client-only, offline-capable PWA.

### Core capabilities

- **Lookup**: Search Traditional Chinese characters to show 速成/倉頡 codes.
- **Decomposition**: Visualize character components/parts and their mapping to keys.
- **Assets**: Per-character SVGs and mapping JSONs, cached for offline use.

### Tech stack

- **Frontend**: SvelteKit + Vite, TypeScript, Tailwind CSS.
- **PWA**: `static/service-worker.js` for caching assets and offline functionality.
- **Testing**: Cypress e2e (`cypress/e2e/sanity.cy.ts`).
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

### Important files/directories

- **UI**: `src/routes/+page.svelte` (main), `src/routes/+layout.svelte`, `src/routes/about/+page.svelte`
- **Components**: `src/lib/CharDecompositionGraph.svelte`, `src/lib/Message.svelte`, `src/lib/Modal.svelte`
- **Logic/Types**: `src/lib/keyToQuickUnit.ts`, `src/lib/types.ts`, `src/lib/utils.ts`
- **PWA**: `static/service-worker.js`, `static/manifest.webmanifest`
- **Scripts**: `scripts/generate-small-mapping.js`, `scripts/get-chars-with-chinese-images.js`, `scripts/scrap-*`
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
- Optimize asset loading/caching strategies and service worker updates.
- Update Cypress tests when UI/flows change.

### Non-goals

- Not an IME/keyboard; purely a reference/visualization tool.
- Not focused on Simplified Chinese unless explicitly requested.
- Avoid server-side components unless requirements change.

### Agent interaction style

- Be concise and technical. Reference concrete file paths like `src/lib/...`.
- Prefer minimal, safe edits with clear diffs. Verify against mapping JSONs when in doubt.
- Consider offline behavior and caching whenever changing asset paths or fetch logic.
