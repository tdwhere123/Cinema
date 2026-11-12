# Local fonts

All files are WOFF2 subsets of Google Fonts families, covering the site's current copy and interface labels. Each upstream license is redistributed alongside.

| File | Family | Role | License |
| --- | --- | --- | --- |
| `cinema-brush.woff2` | Ma Shan Zheng 400 | display titles, chapter names, pull quotes, blank disc (titles/labels only) | SIL OFL 1.1, `Brush-OFL.txt` |
| `cinema-kai.woff2`, `cinema-kai-2.woff2` | LXGW WenKai TC 400 | reading text, interview answers | SIL OFL 1.1, `Kai-OFL.txt` |
| `cinema-hand-400.woff2`, `cinema-hand-700.woff2` | Caveat 400 / 700 | loader counter only | SIL OFL 1.1, `Hand-OFL.txt` |
| `cinema-marker.woff2` | Rock Salt 400 | CINEMA wordmark | Apache 2.0, `Marker-LICENSE.txt` |
| `cinema-serif.woff2` | Noto Serif SC 400 | fallback, reference templates | SIL OFL 1.1, `OFL.txt` |
| `cinema-sans.woff2`, `cinema-sans-2.woff2` | Noto Sans SC 400 | labels, interview questions, fine print | SIL OFL 1.1, `Sans-OFL.txt` |

The Fonts API ignores `text` past a URL-length limit, so the kai and sans faces are fetched as two files split at U+6400; CSS pairs them with `unicode-range`. Subsets keep the upstream font names. System CJK fallbacks cover copy that has not been subsetted yet.

Maintenance: `node scripts/fonts.mjs` fetches fresh subsets through the Google Fonts CSS API and refreshes the license files. It needs network access; build, test and the running site never contact a font service. Rerun it after changing copy.
