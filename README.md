# rack-builder

## GitHub Pages deployment

This repo is configured to auto-deploy to GitHub Pages via `.github/workflows/deploy-pages.yml`.

- Pushes to `main` trigger a production Pages deployment.
- Pull requests trigger GitHub Pages preview deployments.
- The build uses the `BASE_PATH` value produced by `actions/configure-pages`, so static assets resolve correctly for both the main site and PR preview URLs.

To enable this in your repository settings:

1. Go to **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Ensure the default branch is `main` (or update the workflow trigger if you use a different branch).
