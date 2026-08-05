# YTMDesktop2 Stream Deck Plugin

Control [YTMDesktop2](https://github.com/Venipa/ytmdesktop2) from an Elgato Stream Deck.

## Requirements

- YTMDesktop2 with **API** enabled (Settings → API & Integrations → API)
- Stream Deck software 6.9+

## Install (users)

1. In YTMDesktop2: **Settings → API & Integrations → API** → enable API; **Authentication** → Require authorization
2. Download the `.streamDeckPlugin` from the [streamdeck-plugin release](https://github.com/Venipa/ytmdesktop2/releases/tag/streamdeck-plugin) (or open **Settings → Stream Deck → Open website**)
3. Double-click the file (or import it in Stream Deck software)
4. Add any YTMDesktop2 action → open settings → **Authorize**
5. Approve the code in YTMDesktop2 → Authentication

Default endpoint: `http://127.0.0.1:13091`

## Develop / pack (contributors)

```bash
pnpm install
pnpm streamdeck:build
# packaged plugin:
pnpm streamdeck:pack
```

Output: `dist/streamdeck/*.streamDeckPlugin`

CI packs on pushes that touch `packages/streamdeck/**` and uploads artifact `ytmdesktop2-streamdeck`.

Dev link:

```bash
streamdeck link com.venipa.ytmdesktop2.sdPlugin
streamdeck restart com.venipa.ytmdesktop2
```

## Icons

`pnpm streamdeck:icons` regenerates assets from the app logo + Lucide React glyphs (`scripts/generate-icons.mjs`). Runs automatically as part of `build` / `pack`.

## Actions

| Action | API |
|--------|-----|
| Play / Pause | `POST /track/toggle-play-state` |
| Next / Previous | `POST /track/next\|prev` |
| Like / Dislike | `POST /track/like\|dislike` |
| Shuffle / Repeat | `POST /track/shuffle\|repeat` |
| Volume Up / Down | `POST /track/volume-up\|volume-down` |
| Track Info | `GET /track` (title refresh) |
