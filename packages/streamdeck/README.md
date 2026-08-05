# YTMDesktop2 Stream Deck Plugin

Control [YTMDesktop2](https://github.com/Venipa/ytmdesktop2) from an Elgato Stream Deck.

## Requirements

- YTMDesktop2 with **API** enabled (Settings → Stream Deck)
- Stream Deck software 6.9+
- Node.js 20+ (for building)

## Setup

1. In YTMDesktop2: **Settings → API & Integrations → API** → enable API; **Authentication** → Require authorization
2. Build / install this plugin (from repo root):
   ```bash
   pnpm install
   pnpm streamdeck:build
   # optional packaged plugin:
   pnpm streamdeck:pack
   ```
   CI also packs on pushes that touch `packages/streamdeck/**` and uploads a downloadable artifact (`ytmdesktop2-streamdeck`).
3. Link the plugin for development:
   ```bash
   streamdeck link com.venipa.ytmdesktop2.sdPlugin
   streamdeck restart com.venipa.ytmdesktop2
   ```
4. Add any YTMDesktop2 action → open settings → **Authorize**
5. Approve the code in YTMDesktop2 → Authentication

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

Default endpoint: `http://127.0.0.1:13091`
