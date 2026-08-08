# ytmdesktop-userscript

Tampermonkey / Violentmonkey userscript that opens convertible YouTube Music, YouTube, and youtu.be URLs in **YTMDesktop2** via the `ytmd://` protocol.

## Behavior

- **Page load / SPA navigate** — if auto-open is on and the current URL is actionable (watch, playlist, channel, shorts, embed, `@handle`), soft-opens matching `ytmd://` (browser tab stays).
- **No click interception** — normal link clicks stay in the browser.
- **Tampermonkey menu**
  - **Auto-open on load — ON/OFF** — persist toggle (`GM_setValue`)
  - **Open this page now** — open current URL as `ytmd://` even when auto-open is off

Home, search, and other non-actionable paths are ignored.

Requires YTMDesktop2 installed (or protocol registered) so the OS handles `ytmd://`.

## Develop

```bash
pnpm --filter ytmdesktop-userscript dev
# or from repo root:
pnpm userscript:dev
```

## Build

```bash
pnpm --filter ytmdesktop-userscript build
# or:
pnpm userscript:build
```

Output: `dist/ytmdesktop-userscript.user.js`

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey).
2. Open `dist/ytmdesktop-userscript.user.js` in the browser (or paste into a new script).
3. Confirm install. Script matches music.youtube.com, youtube.com, m.youtube.com, and youtu.be.

See also: [docs — Browser userscript](../../apps/docs/content/docs/features/userscript.mdx) (site path `/docs/features/userscript`).
