# Stack Viewer

A denser, more informative viewer for [MyAnimeList Interest Stacks](https://myanimelist.net/stacks). Paste a stack link and see every entry's score, genres, studio, runtime, status and synopsis at a glance, then filter the stack down to what you actually want to watch.

![Stack Viewer showing stack 48557](docs/screenshots/overview.jpg)

## Quick start

```bash
node server.js          # no dependencies, needs Node 18+
# open http://localhost:5177/?stack=48557
```

Paste any `myanimelist.net/stacks/<id>` link (anime or manga stacks) into the box at the top, or pass it in the URL as `?stack=<id>`. Set `PORT` to use a different port.

## What you get

- **Stack header:** title, author, description, a poster stack, and an icon bar of totals: entries, episodes, total runtime, average score (with a small score-spread chart), year range and top-rated entry.
- **Entry cards:** a decision preview per entry with poster, rank, MAL score, format, year, episodes, status, members, genres, a short synopsis and the top community tags. Each card's accents take its poster's dominant colour.
- **Filtering:**
  - Search by title, studio, genre or tag (press `/` to jump to the search box).
  - A score slider for the minimum MyAnimeList score, with a histogram of the stack's scores while you slide.
  - Genre pills with live counts, with Match All / Match Any when you pick several.
  - One sort menu (stack order, score, popularity, year, title, total runtime, episodes) with Asc/Desc.
- **Views and themes:** cards or table, dark or light, and a layout that works on phones.
- **Detail sheet:** click a card for the full synopsis, air dates, season, studio, source, MAL and AniList scores, links (MyAnimeList, AniList, trailer) and community tags with relevance. Spoiler tags stay hidden until you switch them on.

## How it works

1. `server.js` scrapes the MAL stack page (MAL has no stacks API, and its pages block browser CORS).
2. Every entry is enriched in batches of 50 from the AniList GraphQL API, matched by MAL id: genres, tags, studio, episodes, runtime, status, source, synopsis, trailer, cover, dominant colour and banner.
3. Results are cached in `.cache/` for 6 hours. The Refresh button on the stack header bypasses the cache.

The frontend is plain HTML, CSS and JavaScript in `public/`, with no build step.

## Caveats

- Scraping depends on MAL's HTML layout; if it changes, `parseEntries` in `server.js` is the one place to fix.
- A few entries may not exist on AniList; they fall back to MAL-only data.
- Jikan (the usual unofficial MAL API) has no stacks endpoint, and was unreachable from the dev machine.

The screenshot shows stack 48557 ("Best Anime Series Of All Time"). All posters and artwork belong to their respective owners.
