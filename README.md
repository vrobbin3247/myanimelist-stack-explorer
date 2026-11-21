# Stack Viewer

A denser, more informative viewer for [MyAnimeList Interest Stacks](https://myanimelist.net/stacks).

```bash
node server.js          # no dependencies, needs Node 18+
# open http://localhost:5177/?stack=4015
```

Paste any `myanimelist.net/stacks/<id>` link (anime or manga stacks) into the box.

## How it works
1. `server.js` scrapes the MAL stack page (MAL has no stacks API, and its pages block browser CORS).
2. Every entry is enriched in batches of 50 from the AniList GraphQL API, matched by MAL id:
   genres, tags, studio, episodes, runtime, status, source, synopsis, trailer, banner.
3. Results are cached in `.cache/` for 6 hours (`↻ Refresh data` bypasses it).

## Caveats
- Scraping depends on MAL's HTML layout; if it changes, `parseEntries` in `server.js` is the one place to fix.
- A few entries may not exist on AniList; they fall back to MAL-only data.
- Jikan (the usual unofficial MAL API) has no stacks endpoint, and was unreachable from the dev machine.
