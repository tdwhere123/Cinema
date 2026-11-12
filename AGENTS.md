# Cinema

## User decisions

- Preserve the user's self-made posters in `.do-it/`. Do not overwrite originals.
- The eventual repository and temporary event website are intended to be public. Preparing deployment does not authorize remote publishing. Track third-party asset/font licensing separately; public availability does not establish redistribution permission.
- UI reference library: https://github.com/tdwhere123/UI-Vault. Reuse only effects that fit the reference, with applicable notices; do not introduce a new framework merely to import a component.
- Keep formatting-only work separate from behavior changes. Preserve historical evidence in Git and retain third-party notices.
- No event schedule, venue or sign-up information on the site.
- Public repo: https://github.com/tdwhere123/Cinema (GitHub Pages from `main` via `.github/workflows/pages.yml`, base `/Cinema/`). It started from a fresh single-commit history; the earlier private history is kept only on the local branch `archive/private-history` and must not be pushed. Reference-site template pages were removed for licensing; only the two club films are published.

## Working facts

- Vanilla ES modules and bundled Three.js; `npm start` serves port 4173, `npm test` runs Node tests.
- Ignore `.codegraph/` entirely; do not read, refresh, track or publish it.
- Node tests exercise a mocked CSS fallback and are not proof of browser WebGL or visual fidelity. Verify actual browser paths separately.

## Design direction

- Navigation: idle state is a bare CINEMA art wordmark (no pill, border or icon). Opening extends real topics (currently 李沧东专题) and the film index horizontally out of both sides as liquid motion; actions are bare art text, not wrapped cards.
- Typography leans handwritten for display and reading accents, with clear weight hierarchy; fonts must be redistributable (e.g. OFL) and recorded in NOTICE.
- The liquid/dissolve effect is a signature motif: use it more widely across detail pages, at higher quality than a coarse contour clip.
- Poster: origami letter-fold (not a crumple). Hover/focus/tap opens it, leaving refolds it; the flat DOM image is shown only once the sheet is fully open and still, never on top of moving paper.
- Club pages: chapters 故事 / 背景 / 访谈 / 海报 on one grid with generous whitespace and a right-side chapter rail. 访谈 is a cited director interview with a closing source line (internal-sharing use is the user's decision); omit the chapter for a film without one. No viewing-prompts (观看的入口) or placeholder sections. UI-Vault effects are welcome when they fit the style, implemented in vanilla JS with notices.
- Restraint over quantity: the aim is clean, plain, tactile. Effects are material metaphors (liquid stills, ink bleed on display lines, folded paper, physical disc) plus a quiet paragraph settle; no per-character reveals or marker scribbles. Three type voices only: brush display, kai reading, one sans for labels/fine print, with a single ink-red accent used sparingly.
- Films are ordered by release date (`released`), oldest first; a film revealed later may land mid-list. Unannounced selections are blank 「？」 discs (`upcoming` in `src/data.js`, currently one): selectable in the gallery, no page, and the last film's next-section ends quietly on the blank disc.
- Disc derivatives use cover/crop across the entire disc; detail posters retain the full portrait. Original `.do-it/` PNG bytes are immutable.

## Evidence

- Internal plans, design/research/acceptance docs, screenshots and test results belong in ignored `.do-it/` (evidence in `.do-it/docs/`). Build/test never depend on private documents. README, NOTICE and third-party licenses remain tracked. Do not rewrite Git history or push without authorization.
