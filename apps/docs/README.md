# Docs site

Fumadocs site for this repository.

## Env (build-time)

| Variable | Example | Notes |
| --- | --- | --- |
| `REPO_OWNER` | from Actions | GitHub owner |
| `REPO_NAME` | from Actions | Repository name |
| `REPO_URL` | `https://github.com/owner/repo` | Parsed if owner/name omitted |
| `REPO_TITLE` | `YTMDesktop2` | Display title |
| `REPO_BRANCH` | default branch | For blob/edit links |
| `REPO_STARS` | from Actions | Stargazer count for hero |
| `NEXT_PUBLIC_URL` | Pages base URL | Sets Next `basePath` |
| `GITHUB_TOKEN` | Actions token | Higher GitHub API rate limit |

CI sets these in `.github/workflows/docs.yml`.

## Local

```bash
pnpm install
# optional: cp apps/docs/.env.docs.local.example apps/docs/.env.docs.local
pnpm docs:dev
```

Open http://localhost:3000

Env file: `apps/docs/.env.docs.local` (gitignored). Loaded via `next.config.mjs` / `build:pages`.

## Static build (GitHub Pages)

```bash
REPO_OWNER=… REPO_NAME=… REPO_TITLE=YTMDesktop2 \
NEXT_PUBLIC_URL=https://….github.io/… \
pnpm --filter ytmdesktop2-docs build:pages
```
