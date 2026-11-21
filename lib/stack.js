// Stack Viewer core — shared by the local server (server.js) and the Vercel function (api/stack.js).
//   1. scrapes the MAL stack page (MAL has no public API for stacks, and no CORS)
//   2. enriches every entry with AniList (genres, tags, studio, episodes, synopsis, status, trailer)
//   3. caches the merged result on disk (/tmp on Vercel, where the CDN also caches the API response)
const fs = require('fs');
const path = require('path');

const CACHE_DIR = process.env.VERCEL ? '/tmp/stack-cache' : path.join(__dirname, '..', '.cache');
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h
const CACHE_VERSION = 3; // bump when the cached shape changes so old files are refetched
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* read-only filesystem: run uncached */ }

// ---------- helpers ----------
const NAMED = { quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', times: '×', middot: '·', bull: '•', eacute: 'é', amp: '&' };
const decode = (s = '') =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const stripTags = (s = '') => decode(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
const num = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')) || null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  if (!res.ok) throw Object.assign(new Error(`MAL returned HTTP ${res.status}`), { status: res.status === 404 ? 404 : 502 });
  return res.text();
}

// ---------- MAL scraping ----------
function parseEntries(html) {
  const start = html.search(/class="tile-(anime|manga)-list"/);
  if (start < 0) return [];
  const end = html.indexOf('content-right', start);
  const region = html.slice(start, end > 0 ? end : undefined);
  const chunks = region.split('<div class="image">').slice(1);
  const out = [];
  for (const c of chunks) {
    const link = c.match(/href="https:\/\/myanimelist\.net\/(anime|manga)\/(\d+)\/?([^"]*)"/);
    if (!link) continue;
    const img = c.match(/data-src="([^"]+)"/);
    const title = c.match(/<div class="title">\s*<a[^>]*>([\s\S]*?)<\/a>/);
    const cat = c.match(/<div class="category">\s*([\s\S]*?)\s*<\/div>/);
    const [fmt, yr] = stripTags(cat ? cat[1] : '').split(',').map((x) => x.trim());
    const start_date = c.match(/js-start_date">(\d+)</);
    out.push({
      kind: link[1],
      malId: +link[2],
      url: `https://myanimelist.net/${link[1]}/${link[2]}/${link[3]}`,
      title: stripTags(title ? title[1] : ''),
      image: img ? img[1] : null,
      format: fmt || null,
      year: num(yr) || (start_date ? +start_date[1].slice(0, 4) || null : null),
      // visible widget works for both anime and manga tiles (manga has no hidden js-* spans)
      malScore: num((c.match(/<div class="stars">\s*([\d.]+)/) || [])[1]),
      members: num((c.match(/<div class="users">\s*([\d,]+)/) || [])[1]),
    });
  }
  return out;
}

async function scrapeStack(id) {
  const base = `https://myanimelist.net/stacks/${id}`;
  // Authors can pick a default layout (tile/list/seasonal); force tile, the one our parser reads.
  const html = await fetchText(`${base}?view_style=tile`);
  const g = (re) => (html.match(re) || [])[1];
  const ogDesc = g(/og:description" content="[^"]*?(\d+) Entries, (\d+) Restacks/);
  const total = +(html.match(/(\d+) Entries, \d+ Restacks/) || [])[1] || 0;
  const restacks = +(html.match(/\d+ Entries, (\d+) Restacks/) || [])[1] || 0;
  const info = html.match(/<span class="mr4">by<\/span>(?:<a href="([^"]+)">([^<]+)<\/a>|([^<]+))<br>\s*([^|<]*?)(?:&nbsp;\|&nbsp;Updated ([^<]*?))?</);
  const entries = parseEntries(html);

  // Larger stacks may paginate — keep pulling pages until we have everything.
  const seen = new Set(entries.map((e) => e.kind + e.malId));
  for (let p = 2; entries.length < total && p <= 20; p++) {
    let more;
    try { more = parseEntries(await fetchText(`${base}?view_style=tile&page=${p}`)); } catch { break; }
    const fresh = more.filter((e) => !seen.has(e.kind + e.malId));
    if (!fresh.length) break;
    fresh.forEach((e) => { seen.add(e.kind + e.malId); entries.push(e); });
  }

  if (!entries.length) throw Object.assign(new Error(total ? 'Found the stack but could not read its entries (MAL layout may have changed).' : 'No entries found — is that stack ID correct?'), { status: 502 });
  return {
    id: +id,
    url: base,
    title: stripTags(g(/<h2 class="title">([\s\S]*?)<\/h2>/) || ''),
    kind: /tag-manga/.test(html) ? 'manga' : 'anime',
    author: info ? decode(info[2] || info[3]).trim() : null,
    authorUrl: info ? info[1] : null,
    created: info ? decode(info[4]).trim() : null,
    updated: info && info[5] ? decode(info[5]).trim() : null,
    description: stripTags(g(/<div class="introduction">([\s\S]*?)<\/div>/) || '').replace(/[\r ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n'),
    restacks,
    reportedEntries: total || entries.length,
    entries,
  };
}

// ---------- AniList enrichment ----------
const AL_QUERY = `
query ($ids:[Int], $type:MediaType) {
  Page(perPage: 50) {
    media(idMal_in: $ids, type: $type) {
      id idMal siteUrl format status season seasonYear episodes chapters volumes duration
      averageScore popularity favourites source countryOfOrigin isAdult
      title { romaji english native }
      genres
      tags { name rank isMediaSpoiler isGeneralSpoiler }
      studios { edges { isMain node { name isAnimationStudio } } }
      coverImage { extraLarge large color }
      bannerImage
      trailer { id site }
      description(asHtml: false)
      startDate { year month day }
      nextAiringEpisode { episode airingAt }
      stats { statusDistribution { status amount } }
      externalLinks { site type url isDisabled }
      rankings { rank type year season allTime }
      recommendations(sort: RATING_DESC, perPage: 8) { nodes { rating mediaRecommendation { id idMal siteUrl format seasonYear averageScore title { romaji english } coverImage { large color } } } }
    }
  }
}`;

async function anilist(ids, type, attempt = 0) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: AL_QUERY, variables: { ids, type } }),
  });
  if (res.status === 429 && attempt < 3) {
    await sleep((+res.headers.get('retry-after') || 30) * 1000);
    return anilist(ids, type, attempt + 1);
  }
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const j = await res.json();
  return j.data.Page.media;
}

async function enrich(entries) {
  const byKind = { anime: [], manga: [] };
  entries.forEach((e) => byKind[e.kind].push(e.malId));
  const map = new Map();
  for (const kind of ['anime', 'manga']) {
    const ids = byKind[kind];
    for (let i = 0; i < ids.length; i += 50) {
      try {
        const media = await anilist(ids.slice(i, i + 50), kind.toUpperCase());
        media.forEach((m) => map.set(kind + m.idMal, m));
      } catch (err) {
        console.warn('AniList enrichment failed:', err.message);
      }
    }
  }
  return entries.map((e) => {
    const m = map.get(e.kind + e.malId);
    if (!m) return { ...e, enriched: false, genres: [], tags: [] };
    const studios = (m.studios?.edges || []);
    const main = studios.filter((s) => s.isMain).map((s) => s.node.name);
    const studio = (main.length ? main : studios.filter((s) => s.node.isAnimationStudio).map((s) => s.node.name))[0] || null;
    const trailer = m.trailer?.site === 'youtube' ? `https://www.youtube.com/watch?v=${m.trailer.id}`
      : m.trailer?.site === 'dailymotion' ? `https://www.dailymotion.com/video/${m.trailer.id}` : null;
    // who watches it: of the people who started (completed + watching + paused + dropped), how many dropped it
    const dist = Object.fromEntries((m.stats?.statusDistribution || []).map((d) => [d.status, d.amount]));
    const started = (dist.COMPLETED || 0) + (dist.CURRENT || 0) + (dist.PAUSED || 0) + (dist.DROPPED || 0);
    const watch = started >= 100 ? { completed: dist.COMPLETED || 0, current: dist.CURRENT || 0, paused: dist.PAUSED || 0, dropped: dist.DROPPED || 0, planning: dist.PLANNING || 0 } : null;
    // where to watch: legal streaming links only, one per service
    const seenSite = new Set();
    const streams = (m.externalLinks || []).filter((l) => l.type === 'STREAMING' && !l.isDisabled && l.url && !seenSite.has(l.site) && seenSite.add(l.site)).map((l) => ({ site: l.site, url: l.url }));
    // rankings: all-time rated/popular, plus the best "highest rated of <year>"
    const rk = m.rankings || [];
    const best = (list) => list.reduce((a, r) => (!a || r.rank < a.rank ? r : a), null);
    const ratedAll = best(rk.filter((r) => r.type === 'RATED' && r.allTime));
    const popularAll = best(rk.filter((r) => r.type === 'POPULAR' && r.allTime));
    const ratedYear = best(rk.filter((r) => r.type === 'RATED' && !r.allTime && !r.season && r.year));
    const ranks = ratedAll || popularAll || ratedYear
      ? { ratedAll: ratedAll?.rank ?? null, popularAll: popularAll?.rank ?? null, ratedYear: ratedYear ? { rank: ratedYear.rank, year: ratedYear.year } : null }
      : null;
    // "more like this": what AniList users recommend after watching it
    const recs = (m.recommendations?.nodes || [])
      .filter((n) => n.mediaRecommendation && n.rating > 0)
      .map((n) => {
        const r = n.mediaRecommendation;
        return { malId: r.idMal, alId: r.id, url: r.siteUrl, title: r.title.english || r.title.romaji, format: r.format ? r.format.replace(/_/g, ' ') : null, year: r.seasonYear, score: r.averageScore ? r.averageScore / 10 : null, cover: r.coverImage?.large || null, color: r.coverImage?.color || null, votes: n.rating };
      });
    return {
      ...e,
      enriched: true,
      streams,
      ranks,
      recs,
      watch,
      dropRate: watch ? watch.dropped / started : null,
      alId: m.id,
      alUrl: m.siteUrl,
      english: m.title.english,
      romaji: m.title.romaji,
      native: m.title.native,
      format: (m.format || e.format || '').replace(/_/g, ' '),
      status: m.status ? m.status.replace(/_/g, ' ') : null,
      season: m.season,
      year: m.seasonYear || m.startDate?.year || e.year,
      startDate: m.startDate,
      episodes: m.episodes,
      chapters: m.chapters,
      volumes: m.volumes,
      duration: m.duration,
      alScore: m.averageScore ? m.averageScore / 10 : null,
      favourites: m.favourites,
      source: m.source ? m.source.replace(/_/g, ' ') : null,
      country: m.countryOfOrigin,
      isAdult: m.isAdult,
      genres: m.genres || [],
      tags: (m.tags || []).map((t) => ({ name: t.name, rank: t.rank, spoiler: !!(t.isMediaSpoiler || t.isGeneralSpoiler) })),
      studio,
      cover: m.coverImage?.extraLarge || m.coverImage?.large || null,
      color: m.coverImage?.color || null,
      banner: m.bannerImage,
      trailer,
      nextEpisode: m.nextAiringEpisode,
      synopsis: stripTags(m.description || '').replace(/\n{3,}/g, '\n\n'),
    };
  });
}

// ---------- cache + API ----------
const inflight = new Map();
async function getStack(id, force) {
  const file = path.join(CACHE_DIR, `${id}.json`);
  if (!force) {
    try {
      const age = Date.now() - fs.statSync(file).mtimeMs;
      if (age < CACHE_TTL) {
        const hit = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (hit.v === CACHE_VERSION) return { ...hit, cached: true };
      }
    } catch { /* no usable cache entry */ }
  }
  if (inflight.has(id)) return inflight.get(id);
  const job = (async () => {
    const stack = await scrapeStack(id);
    stack.entries = await enrich(stack.entries);
    stack.fetchedAt = new Date().toISOString();
    stack.v = CACHE_VERSION;
    try { fs.writeFileSync(file, JSON.stringify(stack)); } catch { /* cache is best-effort */ }
    return stack;
  })().finally(() => inflight.delete(id));
  inflight.set(id, job);
  return job;
}

// Accepts "4015", "https://myanimelist.net/stacks/4015" or "stacks/4015"; returns the numeric id or null.
function parseStackId(input) {
  const m = String(input || '').match(/(\d+)\s*$|stacks\/(\d+)/);
  return m ? m[2] || m[1] : null;
}

module.exports = { getStack, parseStackId };
