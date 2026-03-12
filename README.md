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


## Environment variables

The app accepts either Vite-style or Expo-style public Supabase variables:

- `VITE_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_KEY`

If not provided, the app falls back to the project's configured public Supabase URL and publishable key.
