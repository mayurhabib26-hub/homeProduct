# Edge meta injection

Covers the window between deploys. See [docs/ARCHITECTURE.md §9](../docs/ARCHITECTURE.md).

The build-time prerender (`frontend/scripts/prerender.ts`) writes real HTML for
every product that existed when the build ran. A product published afterwards
has no page, falls back to the SPA shell, and previews on WhatsApp with the
homepage's title and image.

This Worker only does work when the static asset is **missing**, so a
prerendered page is served untouched at CDN speed. If the catalogue API is slow
or down it falls through to the shell rather than erroring — a human still gets
a working page; only a crawler loses its preview.

## Deploying

1. Fill `API_BASE` and `SITE_URL` in `wrangler.toml`, and bind `ASSETS` to the
   Pages project or bucket holding the build.
2. `npx wrangler deploy`

## Checking it

```bash
# a prerendered product: served from the static build, no x-meta-source header
curl -sI https://<domain>/product/rasam-powder | grep -i x-meta-source

# one published since the last build: should say "edge"
curl -sI https://<domain>/product/<new-slug> | grep -i x-meta-source
```

Neither path should ever return a page whose `<title>` is the homepage's.
