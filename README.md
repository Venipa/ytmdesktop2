> [!NOTE]
> <b>We hit 1000 Stars, thanks for your continued support ♥️</b>
>
> I've never imagined that a personal project for my one use would become that large :)
>
> <b>Additionally v1.0 has been released</b>, completed rewritten services and updated UI.
> stay tuned for new planned features ♥️

<h2 align="center">
    Youtube Music for Desktop (ytmdesktop2)
</h2>


<p align="center">
Beautiful Youtube Music desktop app that includes several customizations for users and developers.
</p>

[![Discord](https://img.shields.io/discord/834826233195003944?color=%237289DA&label=discord&logo=discord&logoColor=%23ffffff&style=for-the-badge)](https://discord.gg/dq4bZMhMjT)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/Venipa/ytmdesktop2?style=for-the-badge)](https://github.com/Venipa/ytmdesktop2/releases/latest)
![GitHub last commit](https://img.shields.io/github/last-commit/Venipa/ytmdesktop2?style=for-the-badge)

<p align="center">
  <img src="./screenshots/screenshot.jpg" alt="app" />
</p>

## Features

### Last.FM (Scrobble)

![ytmdesktop_2024-11-12_01-15-16](https://github.com/user-attachments/assets/54464921-6891-476b-935f-61fdefb7679d)

![feature-lastfm2](https://user-images.githubusercontent.com/17952364/212539540-c1efc587-1047-4748-9583-64b609a1ec97.jpg)

### Tray View

Quick now-playing popup from the system tray with transport controls.

### Discord Rich Presence

<img width="285" height="133" alt="DiscordPTB_rObJDxsJQ8" src="https://github.com/user-attachments/assets/6f6c6836-8916-4a58-940e-e25d632e66ad" />


### Themes

![image](https://user-images.githubusercontent.com/17952364/149849609-fe5d3819-7303-4467-9f8e-56fa1e306c87.png)

### OBS Implementation

[OBS Browser Source Files](https://github.com/Venipa/ytmdesktop2/releases/download/v0.12.11/Zyphen.s.Now.Playing.zip)
/
[OBS Plugin Thread](https://obsproject.com/forum/threads/zyphens-now-playing-overlay.125383/post-557409),
don't forget to enable the api inside the ytmdesktop2 app

also make sure to set a custom the port (`append ?port=<custom port> to source file protocol`) if changed in the app (default is 13091)

### Stream Deck

Control playback from an Elgato Stream Deck via the local API.

1. Settings → **API & Integrations** → **API** → enable API
2. Settings → **Authentication** → Require authorization
3. Download the `.streamDeckPlugin` from [Releases → Stream Deck Plugin](https://github.com/Venipa/ytmdesktop2/releases/tag/streamdeck-plugin) (or from the docs site / app Settings) and double-click / import it in the Stream Deck software
4. In Stream Deck, add a YTMDesktop2 action → **Authorize** → approve under Authentication

---

... features to be added ...
&nbsp;&nbsp;

---

&nbsp;&nbsp;

## Project setup

Monorepo (pnpm workspace). Electron app lives in [`apps/ytmdesktop2`](./apps/ytmdesktop2); Stream Deck plugin in [`packages/streamdeck`](./packages/streamdeck).

```bash
# gh is required for fetching github packages (Venipa/xosms)
gh auth refresh -s read:packages
pnpm install
pnpm dev
```
## Contributors
<a href="https://github.com/Venipa/ytmdesktop2/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Venipa/ytmdesktop2" />
</a>


<div align="center">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=venipa/ytmdesktop2&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=venipa/ytmdesktop2&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=venipa/ytmdesktop2&type=Date" />
 </picture>
</div>
