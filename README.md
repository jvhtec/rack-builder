# rack-builder

## Development

- `npm ci`
- `npm run dev`

## GitHub Pages deployment

This repo auto-deploys to GitHub Pages via `.github/workflows/deploy-pages.yml`.

- Pushes to `main` publish the production site.
- Pull requests publish Pages preview deployments.
- The Vite build uses a relative base path (`./`) by default so assets work on both project Pages URLs and preview URLs.

### Required repository settings

1. Go to **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Ensure your deployment branch trigger in the workflow matches your default branch (`main` by default).
