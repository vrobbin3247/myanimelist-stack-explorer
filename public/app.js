(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const modal = $('#modal');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n) => (n == null ? '—' : n.toLocaleString());
  const short = (n) => (n == null ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };
  const ICON = {
    star: '<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L10 14.2 5 17l1.2-5.6L2 7.6l5.6-.6z"/></svg>',
    users: '<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 9a3 3 0 100-6 3 3 0 000 6zm7 .5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.5 16c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5v.5h-11zm11.8.5v-.4c0-1.3-.4-2.4-1.1-3.3.7-.3 1.4-.4 2.1-.4 2.2 0 4 1.2 4 3.3v.8z"/></svg>',
    heart: '<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.5l-1.2-1.1C4.6 12.600 2 10.300 2 7.400 2 5.100 3.800 3.500 6 3.500c1.300 0 2.600.6 4 2.100 1.400-1.500 2.700-2.100 4-2.100 2.200 0 4 1.600 4 3.900 0 2.900-2.600 5.200-6.800 9z"/></svg>',
  };

  const SI = (d) => `<svg class="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const STAT_ICON = {
    entries: SI('<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M8 4v16M16 4v16M3.5 9h4.5M3.5 15h4.5M16 9h4.5M16 15h4.5"/>'),
    episodes: SI('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 14.5h5"/>'),
    chapters: SI('<path d="M5 4.5h10a3 3 0 013 3V20H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/>'),
    runtime: SI('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>'),
    score: SI('<path d="M12 3.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L12 16.7 6.6 19.7l1.2-5.9L3.4 9.7l6-.7z"/>'),
    years: SI('<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>'),
    top: SI('<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5v1.5A3 3 0 008 10.5M16 6h3v1.5a3 3 0 01-3 3M12 13v4M8.5 20h7M10 17h4"/>'),
  };

  // stroke glyphs for UI chrome (no text characters as icons)
  const GI = (d) => `<svg class="gi" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const GLYPH = {
    ext: GI('<path d="M5.5 10.5l5-5M6.5 5.5h4v4"/>'),
    refresh: GI('<path d="M13 8a5 5 0 11-1.6-3.7M13 2.5V5h-2.5"/>'),
    right: GI('<path d="M3 8h10M9 4l4 4-4 4"/>'),
    up: GI('<path d="M8 13V3M4 7l4-4 4 4"/>'),
    down: GI('<path d="M8 3v10M4 9l4 4 4-4"/>'),
    caretUp: GI('<path d="M4 10l4-4 4 4"/>'),
    caretDown: GI('<path d="M4 6l4 4 4-4"/>'),
    close: GI('<path d="M4 4l8 8M12 4l-8 8"/>'),
    left: GI('<path d="M13 8H3M7 4L3 8l4 4"/>'),
    spark: '<svg class="gi" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5l1.6 4.9 4.9 1.6-4.9 1.6L8 14.5l-1.6-4.9L1.5 8l4.9-1.6z"/></svg>',
    heart: GI('<path d="M8 13.5S2.6 10.2 2.6 6.1A2.9 2.9 0 018 4.9a2.9 2.9 0 015.4 1.2c0 4.100-5.400 7.400-5.400 7.400z"/>'),
    gem: GI('<path d="M3.2 6.2L5.4 3h5.2l2.2 3.2L8 13z"/><path d="M3.2 6.2h9.6M8 13L6 6.2 7.2 3M8 13l2-6.8L8.8 3"/>'),
    drop: GI('<path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3.5 13.5h9"/>'),
    play: '<svg class="gi" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 00.9.5l7.6-4.8a.6.6 0 000-1L5.9 2.7a.6.6 0 00-.9.5z"/></svg>',
  };

  // ---------- state ----------
  const GENRES_SHOWN = 10;
  const state = {
    data: null,
    view: store.get('sv-view') || 'cards',
    q: '',
    genres: new Set(),
    genreMode: 'all',
    minScore: 0,
    allGenres: false,
    sort: 'stack',
    desc: false,
    range: { lo: 0, hi: 10 },
    descOpen: false,
    gemsOnly: false,
    gem: null,
  };

  const SORTS = {
    stack: { label: 'Stack order', get: (e) => e._i, dir: 1 },
    score: { label: 'Score', get: (e) => e.malScore ?? -1, dir: -1 },
    members: { label: 'Popularity', get: (e) => e.members ?? -1, dir: -1 },
    year: { label: 'Year', get: (e) => e.year ?? 0, dir: -1 },
    title: { label: 'Title', get: (e) => (e.english || e.title).toLowerCase(), dir: 1 },
    length: { label: 'Total runtime', get: (e) => lengthMin(e), dir: -1 },
    episodes: { label: 'Episodes', get: (e) => (e.episodes ?? e.chapters ?? -1), dir: -1 },
    drop: { label: 'Drop rate', get: (e) => e.dropRate ?? 2, dir: 1 },
  };

  const lengthMin = (e) => (e.episodes && e.duration ? e.episodes * e.duration : -1);
  const fmtHours = (min) => (min <= 0 ? '—' : min < 120 ? `${Math.round(min)}m` : min < 60 * 48 ? `${(min / 60).toFixed(1)}h` : `${(min / 1440).toFixed(1)}d`);
  const scoreCls = (s) => (s == null ? '' : s >= 8 ? 's-hi' : s >= 7 ? 's-ok' : s >= 6 ? 's-lo' : 's-bad');
  const titleOf = (e) => e.english || e.title;
  const altTitle = (e) => { const t = titleOf(e); return [e.romaji, e.title].find((x) => x && x !== t && !t.includes(x) && !x.includes(t)) || ''; };
  const lenText = (e) => {
    if (e.kind === 'manga') return e.chapters ? `${e.chapters} ch` : e.volumes ? `${e.volumes} vol` : '';
    if (e.episodes == null) return '? eps';
    return `${e.episodes} ep${e.episodes === 1 ? '' : 's'}${e.duration ? ` × ${e.duration}m` : ''}`;
  };
  const STATUS = { FINISHED: ['Finished', 'done'], RELEASING: ['Airing', 'live'], 'NOT YET RELEASED': ['Upcoming', 'soon'], CANCELLED: ['Cancelled', ''], HIATUS: ['Hiatus', 'soon'] };
  const statusDot = (e) => {
    if (!e.status) return '';
    const [label, cls] = STATUS[e.status] || [e.status, ''];
    return `<span class="status-dot ${cls}" title="${esc(label)}">${esc(label)}</span>`;
  };
  // Commitment risk: of everyone who started it (completed, watching, paused, dropped), the share who dropped it.
  const RISK = { low: ['Rarely dropped', 'r-low'], mid: ['Sometimes dropped', 'r-mid'], high: ['Often dropped', 'r-high'] };
  const riskOf = (e) => (e.dropRate == null ? null : e.dropRate < 0.05 ? 'low' : e.dropRate < 0.1 ? 'mid' : 'high');
  const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
  const WATCH = [['completed', 'Completed'], ['current', 'Watching'], ['paused', 'Paused'], ['dropped', 'Dropped']];
  const cap = (s) => (s ? s[0] + s.slice(1).toLowerCase() : '');

  // ---------- data ----------
  function parseInput(v) {
    const m = String(v).match(/stacks\/(\d+)/) || String(v).trim().match(/^(\d+)$/);
    return m ? m[1] : null;
  }

  async function load(id, refresh = false) {
    app.innerHTML = `<div class="status"><div class="spinner"></div>Fetching stack ${esc(id)} and enriching entries…<br><small>First load takes a few seconds; repeat loads are cached.</small></div>`;
    try {
      const res = await fetch(`/api/stack?id=${id}${refresh ? '&refresh=1' : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      data.entries.forEach((e, i) => { e._i = i; if (e.format) e.format = e.format.toUpperCase().replace(/-/g, ' '); });
      Object.assign(state, { data, q: '', genres: new Set(), genreMode: 'all', minScore: 0, allGenres: false, sort: 'stack', desc: false, descOpen: false, gemsOnly: false });
      document.title = `${data.title} · Stack Viewer`;
      history.replaceState(null, '', `?stack=${id}`);
      render();
    } catch (err) {
      app.innerHTML = `<div class="status err"><b>Couldn't load that stack.</b><br>${esc(err.message)}</div>`;
    }
  }

  // ---------- derived ----------
  // Filters split in two so genre counts can be "faceted": base filters (search, format, score)
  // and genre filters. Each genre pill shows how many entries it would leave, given everything else.
  function passesBase(e) {
    const { q, minScore } = state;
    if (minScore && !(e.malScore >= minScore)) return false;
    if (state.gemsOnly && !isGem(e)) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const hay = [e.title, e.english, e.romaji, e.studio, ...e.genres, ...e.tags.map((t) => t.name)].join(' ').toLowerCase();
    return hay.includes(needle);
  }
  function passesGenres(e) {
    if (!state.genres.size) return true;
    const picked = [...state.genres];
    return state.genreMode === 'any' ? picked.some((g) => e.genres.includes(g)) : picked.every((g) => e.genres.includes(g));
  }
  const filtersActive = () => !!(state.q.trim() || state.minScore || state.genres.size || state.gemsOnly);

  function visible() {
    const { data, sort, desc } = state;
    const list = data.entries.filter((e) => passesBase(e) && passesGenres(e));
    const s = SORTS[sort];
    return [...list].sort((a, b) => {
      const x = s.get(a), y = s.get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1) || a._i - b._i;
    });
  }

  function tally(entries, pick) {
    const m = new Map();
    entries.forEach((e) => [].concat(pick(e) || []).forEach((k) => k && m.set(k, (m.get(k) || 0) + 1)));
    return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(b[0]));
  }

  // ---------- render ----------
  function render() {
    const { data } = state;
    const es = data.entries;
    const isAnime = data.kind !== 'manga';
    const scores = es.map((e) => e.malScore).filter((x) => x != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const totalEps = es.reduce((a, e) => a + (e.episodes || 0), 0);
    const totalMin = es.reduce((a, e) => a + Math.max(lengthMin(e), 0), 0);
    const totalCh = es.reduce((a, e) => a + (e.chapters || 0), 0);
    const years = es.map((e) => e.year).filter(Boolean);
    const best = [...es].filter((e) => e.malScore).sort((a, b) => b.malScore - a.malScore)[0];
    const formatCounts = tally(es, (e) => e.format);
    const topGenres = tally(es, (e) => e.genres).slice(0, 3).map(([g, c]) => `${g} ${c}`).join(' · ');
    const descLong = data.description.length > 200;
    state.gem = gemStats();
    if (scores.length) {
      let lo = Math.floor(Math.min(...scores)), hi = Math.ceil(Math.max(...scores));
      if (hi - lo < 1) lo = hi - 1;
      state.range = { lo, hi };
    }
    const stat = (icon, l, v, sub = '', cls = '', extra = '') => `<div class="stat"${sub ? ` title="${esc(String(sub).replace(/<[^>]*>/g, ''))}"` : ''}>${STAT_ICON[icon]}<div class="st-text"><dt>${l}</dt><dd class="${cls}">${v}</dd></div>${extra}</div>`;

    const fan = es.filter((e) => e.cover || e.image).slice(0, 5);
    const hexes = es.map((e) => e.color).filter((c) => /^#[0-9a-f]{6}$/i.test(c || '')).slice(0, 4);
    const wash = hexes.map((c, i) => `radial-gradient(55% 150% at ${100 - i * 24}% ${i % 2 ? '100%' : '0%'}, color-mix(in srgb, ${c} ${24 - i * 4}%, transparent), transparent 72%)`).join(',');
    const bins = [0, 0, 0, 0, 0];
    scores.forEach((x) => { bins[x < 6 ? 0 : x < 7 ? 1 : x < 8 ? 2 : x < 9 ? 3 : 4]++; });
    const peak = Math.max(...bins, 1);
    const distLabels = ['under 6', '6s', '7s', '8s', '9 and up'];
    const dist = scores.length > 4
      ? `<span class="dist" role="img" aria-label="Score spread" title="${bins.map((n, i) => `${distLabels[i]}: ${n}`).join(', ')}">${bins.map((n) => `<i style="--h:${(n / peak).toFixed(2)}"></i>`).join('')}</span>`
      : '';
    const byline = [
      data.author ? `${isAnime ? 'Anime' : 'Manga'} stack by ${data.authorUrl ? `<a href="${esc(data.authorUrl)}" target="_blank" rel="noopener">${esc(data.author)}</a>` : esc(data.author)}` : `${isAnime ? 'Anime' : 'Manga'} stack`,
      data.updated ? `updated ${esc(data.updated)}` : '',
      data.restacks ? `${fmtNum(data.restacks)} ${data.restacks === 1 ? 'restack' : 'restacks'}` : '',
    ].filter(Boolean).join(', ');

    app.innerHTML = `
      <section class="masthead" ${wash ? `style="--wash:${wash}"` : ''}>
        <div class="head-main">
          <div class="eyebrow">${byline}</div>
          <h2>${esc(data.title)}</h2>
          ${data.description ? `<p class="desc ${descLong && !state.descOpen ? 'clamp' : ''}">${esc(data.description)}</p>${descLong ? `<button class="linklike" id="descToggle" type="button">${state.descOpen ? 'Show less' : 'Read more'}</button>` : ''}` : ''}
          <div class="head-actions">
            <a class="btn ghost" href="${esc(data.url)}" target="_blank" rel="noopener">Open on MAL ${GLYPH.ext}</a>
            <button class="btn ghost" id="refresh" type="button">${GLYPH.refresh} Refresh</button>
          </div>
        </div>
        ${fan.length ? `<div class="fan" aria-hidden="true">${fan.map((e, i) => `<img src="${esc(e.cover || e.image)}" alt="" style="z-index:${fan.length - i}">`).join('')}</div>` : ''}
        <dl class="strip">
          ${stat('entries', 'Entries', es.length, formatCounts.map(([f, c]) => `${esc(f)} ${c}`).join(' · '))}
          ${isAnime
            ? stat('episodes', 'Episodes', fmtNum(totalEps), es.length ? `≈ ${Math.round(totalEps / es.length)} per entry` : '') + stat('runtime', 'Runtime', fmtHours(totalMin), totalMin > 0 ? `≈ ${Math.round(totalMin / 60)} hours` : '')
            : stat('chapters', 'Chapters', fmtNum(totalCh), es.length ? `≈ ${Math.round(totalCh / es.length)} per entry` : '')}
          ${stat('score', 'Avg score', avg ? avg.toFixed(2) : '—', `of ${scores.length} rated`, scoreCls(avg), dist)}
          ${stat('years', 'Years', years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—', esc(topGenres))}
          ${stat('top', 'Top rated', best?.malScore?.toFixed(2) ?? '—', esc(best ? titleOf(best) : ''), scoreCls(best?.malScore))}
        </dl>
      </section>

      <div class="toolbar">
        <div class="search">
          <svg class="s-ico" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.6 10.6 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <input type="search" id="q" placeholder="Search title, studio or tag" value="${esc(state.q)}" aria-label="Filter entries" autocomplete="off">
          <kbd aria-hidden="true">/</kbd>
        </div>
        ${scores.length ? scoreRow(scores) : ''}
        <span class="tb-end">
          <span class="count" id="count" aria-live="polite"></span>
          <button class="linklike" id="clearAll" type="button" hidden>Clear</button>
          ${state.gem ? `<button class="tb-btn gems-btn" id="gemsBtn" type="button" aria-pressed="${state.gemsOnly}" title="Hidden gems: scored above this stack's average (${state.gem.avg.toFixed(2)}) but fewer members than its median (${short(Math.round(state.gem.med))})">${GLYPH.gem}<span class="lbl">Hidden gems</span><small>${state.gem.es.filter(isGem).length}</small></button>` : ''}
          <div class="dd end">
            <button class="tb-btn" id="sortBtn" type="button" aria-haspopup="menu" aria-expanded="false"><span class="arrow" id="sortArrow"></span><span id="sortLabel"></span><svg class="chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <div class="pop pop-sort" id="sortPop" role="menu" aria-label="Sort by" hidden>
              ${Object.entries(SORTS).map(([k, o]) => `<button type="button" role="menuitemradio" data-sortkey="${k}" aria-checked="false"><span>${o.label}</span><svg class="check" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join('')}
              <div class="pop-foot" role="group" aria-label="Order"><button type="button" data-order="asc">${GLYPH.up} Asc</button><button type="button" data-order="desc">${GLYPH.down} Desc</button></div>
            </div>
          </div>
          <div class="seg icons" role="group" aria-label="View">
            <button data-view="cards" aria-label="Card view" title="Card view" aria-pressed="${state.view === 'cards'}"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2.5" y="2.5" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="10.5" y="2.5" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="2.5" y="10.5" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="10.5" y="10.5" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
            <button data-view="table" aria-label="Table view" title="Table view" aria-pressed="${state.view === 'table'}"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4.5h8M7 9h8M7 13.5h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="3.6" cy="4.5" r="1" fill="currentColor"/><circle cx="3.6" cy="9" r="1" fill="currentColor"/><circle cx="3.6" cy="13.5" r="1" fill="currentColor"/></svg></button>
          </div>
        </span>
      </div>
      <div class="genre-row" id="genreRow"></div>
      <div id="results"></div>`;

    wire();
    renderGenres();
    renderResults();
  }


  // Score filter: histogram of the stack's scores (half-point buckets) over a slider; the pill is the thumb.
  function scoreRow(scores) {
    const { lo, hi } = state.range, n = (hi - lo) * 2;
    const bins = Array.from({ length: n }, () => 0);
    scores.forEach((x) => { bins[Math.min(n - 1, Math.max(0, Math.floor((x - lo) * 2)))]++; });
    const peak = Math.max(...bins, 1);
    return `<div class="scoref" id="scoref">
      <span class="scoref-label"><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.2 4.1 13.4 5 9.1 1.7 6.1l4.4-.5z" fill="currentColor"/></svg>Score</span>
      <div class="sbar">
        <div class="strack">
          <div class="shist" aria-hidden="true">${bins.map((c, i) => `<span class="b" data-bmin="${(lo + i / 2).toFixed(1)}" style="--h:${(c / peak).toFixed(2)}" title="${(lo + i / 2).toFixed(1)}–${(lo + (i + 1) / 2).toFixed(1)}: ${c} ${c === 1 ? 'entry' : 'entries'}"><em>${c}</em><i></i></span>`).join('')}</div>
          <input type="range" id="scoreRange" min="${lo}" max="${hi}" step="0.1" aria-label="Minimum MyAnimeList score">
          <output class="sthumb" id="scoreThumb" for="scoreRange"></output>
        </div>
      </div>
    </div>`;
  }

  function renderGenres() {
    const order = tally(state.data.entries, (e) => e.genres);
    const base = state.data.entries.filter(passesBase);
    const pool = state.genreMode === 'all' ? base.filter(passesGenres) : base;
    const left = new Map(tally(pool, (e) => e.genres));
    const shown = state.allGenres ? order : order.filter(([g], i) => i < GENRES_SHOWN || state.genres.has(g));
    const hidden = order.length - shown.length;
    const pill = ([g]) => {
      const n = left.get(g) || 0, on = state.genres.has(g);
      return `<button class="pill" data-genre="${esc(g)}" aria-pressed="${on}" ${n || on ? '' : 'disabled'} title="${n} ${n === 1 ? 'entry' : 'entries'}${on ? '' : ' with this genre'}">${esc(g)}<small>${n}</small></button>`;
    };
    $('#genreRow').innerHTML =
      '<span class="fb-label">Genres</span>' + shown.map(pill).join('') +
      (hidden > 0 ? `<button class="pill more" id="moreGenres" type="button">${hidden} more</button>` : state.allGenres && order.length > GENRES_SHOWN ? '<button class="pill more" id="moreGenres" type="button">Show fewer</button>' : '') +
      (state.genres.size > 1
        ? `<span class="seg sm" role="group" aria-label="Match genres"><span class="seg-label">Match</span><button type="button" data-mode="all" aria-pressed="${state.genreMode === 'all'}">All</button><button type="button" data-mode="any" aria-pressed="${state.genreMode === 'any'}">Any</button></span>`
        : '') +
      (state.genres.size ? '<button class="linklike" id="clearGenres" type="button">Clear genres</button>' : '');
  }

  function renderResults() {
    const list = visible();
    $('#count').textContent = `${list.length} / ${state.data.entries.length}`;
    syncControls();
    renderGenres();
    const box = $('#results');
    if (!list.length) {
      box.dataset.sig = '';
      box.innerHTML = '<div class="status"><b>Nothing matches those filters</b>Loosen the search, lower the minimum score, or clear a genre.<br><button class="btn ghost" id="clearAllEmpty" type="button" style="margin-top:14px">Clear all filters</button></div>';
      return;
    }
    const sig = state.view + ':' + list.map((e) => e._i).join(',');
    if (box.dataset.sig === sig) return; // same entries, same order: keep the DOM (and decoded posters)
    box.dataset.sig = sig;
    box.innerHTML = state.view === 'table' ? tableHTML(list) : `<div class="cards">${list.map(cardHTML).join('')}</div>`;
    if (state.view !== 'table') fitCards();
  }

  const scoreBadge = (e) => (e.malScore != null
    ? `<span class="badge" title="MyAnimeList score">${ICON.star}<b>${e.malScore.toFixed(2)}</b><i>MAL</i></span>`
    : '<span class="badge none" title="No MyAnimeList score yet">Unrated</span>');

  // ---------- hidden gems ----------
  // Score vs popularity: entries above the stack's average score but below its median member count.
  function gemStats() {
    const es = state.data.entries.filter((e) => e.malScore != null && e.members > 0);
    if (es.length < 6) return null;
    const avg = es.reduce((a, e) => a + e.malScore, 0) / es.length;
    const ms = es.map((e) => e.members).sort((a, b) => a - b), h = ms.length >> 1;
    const med = ms.length % 2 ? ms[h] : (ms[h - 1] + ms[h]) / 2;
    const q3 = ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.75) - 1)];
    return { es, avg, med, q3 };
  }
  const isGem = (e) => !!state.gem && e.malScore != null && e.members > 0 && e.malScore > state.gem.avg && e.members < state.gem.med;

  // the mirror image of a gem: scored above the stack's average and in its most-watched quarter
  const isFav = (e) => !!state.gem && e.malScore != null && e.members > 0 && e.malScore > state.gem.avg && e.members >= state.gem.q3;
  const favTitle = () => `Crowd favourite: scored above this stack's average (${state.gem.avg.toFixed(2)}) and among its most-watched quarter (${short(Math.round(state.gem.q3))}+ members)`;
  const gemTitle = () => `Hidden gem: scored above this stack's average (${state.gem.avg.toFixed(2)}) but fewer members than its median (${short(Math.round(state.gem.med))})`;
  const gemMark = (e) => (isGem(e) ? `<span class="gempill" title="${esc(gemTitle())}">${GLYPH.gem}<span>Hidden gem</span></span>`
    : isFav(e) ? `<span class="gempill fav" title="${esc(favTitle())}">${GLYPH.heart}<span>Crowd favourite</span></span>` : '');

  // only the risky ones get a flag on the card; every entry's full breakdown is in the detail sheet
  const riskFlag = (e) => (riskOf(e) === 'high'
    ? `<span class="riskflag" title="${pct(e.dropRate)} of people who started this dropped it">${GLYPH.drop} ${pct(e.dropRate)} dropped</span>`
    : '');

  // Cards are decision previews: one meta line, one genre row, two lines of synopsis.
  // Length per episode, source and the full tag list live in the detail sheet.
  function cardHTML(e) {
    const topTags = e.tags.filter((t) => !t.spoiler).slice(0, 4).map((t) => t.name);
    const eps = e.kind === 'manga' ? (e.chapters ? `${e.chapters} ch` : '') : (e.episodes != null ? `${e.episodes} eps` : '');
    const genres = e.genres.slice(0, 4);
    return `<article class="acard${isGem(e) ? ' is-gem' : isFav(e) ? ' is-fav' : ''}" ${/^#[0-9a-f]{6}$/i.test(e.color || '') ? `style="--tint:${e.color}"` : ''} data-open="${e._i}" tabindex="0" role="button" aria-label="${esc(titleOf(e))}, open details">
      ${gemMark(e)}
      <div class="poster"><img loading="lazy" src="${esc(e.cover || e.image)}" alt=""><span class="rank">#${e._i + 1}</span>${riskFlag(e)}${scoreBadge(e)}</div>
      <div class="body">
        <div class="head">
          <h4 title="${esc(titleOf(e))}">${esc(titleOf(e))}</h4>
          <div class="alt">${esc(altTitle(e))}</div>
        </div>
        <div class="line sep">
          ${e.format ? `<span><span class="fmt-chip">${esc(e.format)}</span></span>` : ''}
          ${e.year ? `<span>${e.year}</span>` : ''}
          ${eps ? `<span>${esc(eps)}</span>` : ''}
          ${e.studio ? `<span class="studio">${esc(e.studio)}</span>` : ''}
          ${statusDot(e) ? `<span>${statusDot(e)}</span>` : ''}
          ${e.members != null ? `<span title="MyAnimeList members">${ICON.users} ${short(e.members)}</span>` : ''}
        </div>
        ${genres.length ? `<div class="genres" data-extra="${e.genres.length - genres.length}">${genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}<span class="chip more" hidden></span></div>` : ''}
        ${e.synopsis ? `<p class="syn">${esc(e.synopsis)}</p>` : ''}
        <div class="foot">
          <span class="tagline">${topTags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>
          <span class="more-cue">Details <span aria-hidden="true">${GLYPH.right}</span></span>
        </div>
      </div></article>`;
  }

  // Keep genres to a single row: hide chips that don't fit and fold them into a "+N" chip.
  function fitGenres() {
    document.querySelectorAll('.acard .genres').forEach((box) => {
      const chips = [...box.querySelectorAll('.chip:not(.more)')];
      const more = box.querySelector('.more');
      chips.forEach((c) => (c.hidden = false));
      let extra = +box.dataset.extra;
      const setMore = () => { more.textContent = `+${extra}`; more.hidden = extra === 0; };
      setMore();
      for (let i = chips.length - 1; i > 0 && box.scrollWidth > box.clientWidth; i--) {
        chips[i].hidden = true; extra++; setMore();
      }
    });
  }
  // bottom tags: drop whole pills from the end until the row fits (never show a half-clipped pill)
  function fitTags() {
    document.querySelectorAll('.acard .tagline').forEach((box) => {
      const tags = [...box.querySelectorAll('.tag')];
      tags.forEach((t) => (t.hidden = false));
      for (let i = tags.length - 1; i > 0 && box.scrollWidth > box.clientWidth; i--) tags[i].hidden = true;
    });
  }
  const fitCards = () => { fitGenres(); fitTags(); };
  let fitTimer;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitCards, 120); });

  function tableHTML(list) {
    const isManga = state.data.kind === 'manga';
    const cols = [
      ['#', 'stack', 'num'], ['Title', 'title'], ['Format'], ['Year', 'year', 'num'],
      [isManga ? 'Chapters' : 'Eps', 'episodes', 'num'], ...(isManga ? [] : [['Runtime', 'length', 'num']]),
      ...(isManga ? [] : [['Studio']]), ['Score', 'score', 'num'], ['Members', 'members', 'num'], ...(isManga ? [] : [['Drop', 'drop', 'num']]), ['Status'], ['Genres'],
    ];
    const th = cols.map(([label, key, cls]) => {
      const on = key && state.sort === key;
      return `<th class="${cls || ''}" ${key ? `data-sort="${key}"` : ''} ${on ? `aria-sort="${state.desc ? 'descending' : 'ascending'}"` : ''}>${label}${on ? `<span class="ar">${state.desc ? GLYPH.caretDown : GLYPH.caretUp}</span>` : ''}</th>`;
    }).join('');
    const rows = list.map((e) => `<tr data-open="${e._i}" tabindex="0">
      <td class="num">${e._i + 1}</td>
      <td><div class="tcell"><img loading="lazy" src="${esc(e.cover || e.image)}" alt=""><div><b>${esc(titleOf(e))}${isGem(e) ? ` <span class="gemmark inline" title="${esc(gemTitle())}" role="img" aria-label="Hidden gem">${GLYPH.gem}</span>` : isFav(e) ? ` <span class="gemmark inline fav" title="${esc(favTitle())}" role="img" aria-label="Crowd favourite">${GLYPH.heart}</span>` : ''}</b><small>${esc(altTitle(e))}</small></div></div></td>
      <td><span class="fmt-chip">${esc(e.format || '—')}</span></td>
      <td class="num">${e.year ?? '—'}</td>
      <td class="num">${(isManga ? e.chapters : e.episodes) ?? '?'}</td>
      ${isManga ? '' : `<td class="num">${fmtHours(lengthMin(e))}</td>`}
      ${isManga ? '' : `<td>${esc(e.studio || '—')}</td>`}
      <td class="num"><span class="score ${scoreCls(e.malScore)}">${e.malScore?.toFixed(2) ?? '—'}</span></td>
      <td class="num">${fmtNum(e.members)}</td>
      ${isManga ? '' : `<td class="num">${e.dropRate == null ? '—' : `<span class="drop ${RISK[riskOf(e)][1]}">${pct(e.dropRate)}</span>`}</td>`}
      <td>${statusDot(e) || '—'}</td>
      <td><div class="genres">${e.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div></td></tr>`).join('');
    return `<div class="tablewrap"><table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- detail modal ----------
  function watchBlock(e) {
    const w = e.watch, r = riskOf(e);
    if (!w) return '';
    const total = WATCH.reduce((a, [k]) => a + w[k], 0);
    const seg = WATCH.map(([k, l]) => `<i class="w-${k}" style="flex:${w[k]}" title="${l}: ${fmtNum(w[k])}"></i>`).join('');
    const key = WATCH.map(([k, l]) => `<span><i class="w-${k}"></i>${l} <b>${pct(w[k] / total)}</b></span>`).join('');
    return `<div class="watchblock">
      <div class="tag-head"><h5>Commitment risk</h5><span class="riskpill ${RISK[r][1]}">${RISK[r][0]}</span><span class="wnote" title="${fmtNum(w.planning)} more have it planned">${pct(e.dropRate)} of ${fmtNum(total)} who started it dropped</span></div>
      <div class="wbar" role="img" aria-label="${WATCH.map(([k, l]) => `${l} ${pct(w[k] / total)}`).join(', ')}">${seg}</div>
      <div class="wkey">${key}</div>
    </div>`;
  }
  function openDetail(i) {
    const e = state.data.entries[i];
    if (!e) return;
    const isManga = e.kind === 'manga';
    const air = e.startDate?.year ? [e.startDate.year, e.startDate.month, e.startDate.day].filter(Boolean).join('-') : e.year;
    const fact = (l, v) => (v || v === 0 ? `<div class="fact"><span>${l}</span><b>${v}</b></div>` : '');
    const epText = isManga ? (e.chapters ? `${e.chapters} ch` : '') : e.episodes != null ? `${e.episodes}${e.duration ? ` × ${e.duration}m` : ''}` : '';

    // tags: top 8 visible, "Show all" expands; spoiler tags stay hidden until the switch is on
    const TAGS_SHOWN = 8;
    const tags = [...e.tags].sort((a, b) => b.rank - a.rank);
    const plain = tags.filter((t) => !t.spoiler);
    const spoil = tags.filter((t) => t.spoiler);
    const tagChip = (t) => `<span class="tagchip${t.spoiler ? ' is-spoiler' : ''}" style="--r:${t.rank}" title="${t.rank}% of voters${t.spoiler ? ' · spoiler' : ''}">${esc(t.name)}<small>${t.rank}%</small></span>`;

    // AniList appends "(Source: …)" to descriptions — show it as a quiet credit line
    const syn = (e.synopsis || '').trim();
    const m = syn.match(/^([\s\S]*?)\s*\n\s*\((Source:[^)]*)\)\s*$/);
    const body = m ? m[1] : syn;
    const credit = m ? m[2] : '';

    modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titleOf(e))}" style="${e.banner ? `--banner:url('${esc(e.banner)}')` : e.color ? `--tint:${esc(e.color)}` : ''}">
      <button class="close" aria-label="Close">${GLYPH.close}</button>
      <aside class="side">
        <img class="cover" src="${esc(e.cover || e.image)}" alt="">
        <div class="scorebox">
          <div class="big score ${scoreCls(e.malScore)}">${ICON.star}<span>${e.malScore?.toFixed(2) ?? '—'}</span></div>
          <div class="lbl">MyAnimeList score</div>
          <div class="mini">
            ${e.alScore ? `<span title="AniList score">${e.alScore.toFixed(1)} AniList</span>` : ''}
            <span title="MAL members">${ICON.users} ${short(e.members)}</span>
            ${e.favourites ? `<span title="AniList favourites">${ICON.heart} ${short(e.favourites)}</span>` : ''}
          </div>
        </div>
        <div class="links">
          <a href="${esc(e.url)}" target="_blank" rel="noopener">MyAnimeList ${GLYPH.ext}</a>
          ${e.alUrl ? `<a href="${esc(e.alUrl)}" target="_blank" rel="noopener">AniList ${GLYPH.ext}</a>` : ''}
          ${e.trailer ? `<a href="${esc(e.trailer)}" target="_blank" rel="noopener">${GLYPH.play} Trailer</a>` : ''}
        </div>
      </aside>
      <section class="main">
        <h3>${esc(titleOf(e))}${isGem(e) ? ` <span class="gem-tag" title="${esc(gemTitle())}">${GLYPH.gem} Hidden gem</span>` : isFav(e) ? ` <span class="gem-tag fav" title="${esc(favTitle())}">${GLYPH.heart} Crowd favourite</span>` : ''}</h3>
        <div class="jp">${esc([e.romaji !== titleOf(e) ? e.romaji : '', e.native].filter(Boolean).join(' · '))}</div>
        <div class="facts">
          ${fact('Format', esc(e.format))}${fact('Status', esc(cap(e.status)))}
          ${fact(isManga ? 'Chapters' : 'Episodes', esc(epText))}${isManga ? fact('Volumes', e.volumes) : fact('Runtime', lengthMin(e) > 0 ? fmtHours(lengthMin(e)) : '')}
          ${fact('Aired', esc(air))}${fact('Season', esc(e.season ? cap(e.season) + ' ' + (e.year || '') : ''))}
          ${isManga ? '' : fact('Studio', esc(e.studio))}${fact('Source', esc(cap(e.source)))}
          ${e.nextEpisode ? fact('Next episode', `Ep ${e.nextEpisode.episode} · ${new Date(e.nextEpisode.airingAt * 1000).toLocaleDateString()}`) : ''}
        </div>
        <div class="genres">${e.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>
        <div class="synwrap">
          <p class="syn-full">${esc((body || 'No synopsis available.').replace(/\n[ \t]*(?:\n[ \t]*)+/g, '\n\n').trim())}</p>
          ${credit ? `<div class="credit">${esc(credit)}</div>` : ''}
        </div>
        ${watchBlock(e)}
        ${tags.length ? '<div class="tagblock" id="tagblock"></div>' : ''}
      </section></div>`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal._opener = document.activeElement;
    $('.close', modal).focus();
    const tagBox = $('#tagblock', modal);
    if (tagBox) {
      let showSpoilers = false, showAll = false;
      const renderTags = (refocus) => {
        const list = showSpoilers ? tags : plain;
        const vis = showAll ? list : list.slice(0, TAGS_SHOWN);
        tagBox.innerHTML = `
          <div class="tag-head">
            <h5>Community tags</h5>
            ${spoil.length ? `<label class="switch-row"><span>Show spoilers <em>(${spoil.length})</em></span>
              <button type="button" role="switch" class="switch" id="spoilSwitch" aria-checked="${showSpoilers}"></button></label>` : ''}
          </div>
          <div class="tagchips">${vis.map(tagChip).join('')}</div>
          <div class="tag-foot">
            ${list.length > TAGS_SHOWN ? `<button class="linklike more-tags" id="allTags" type="button" aria-expanded="${showAll}">${showAll ? 'Show fewer' : `Show ${list.length - TAGS_SHOWN} more`}<svg class="chev" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ''}
          </div>`;
        if (refocus) $(refocus, tagBox)?.focus();
      };
      tagBox.addEventListener('click', (ev) => {
        if (ev.target.closest('#spoilSwitch')) { showSpoilers = !showSpoilers; renderTags('#spoilSwitch'); }
        else if (ev.target.closest('#allTags')) { showAll = !showAll; renderTags('#allTags'); }
      });
      renderTags();
    }
  }
  function closeDetail() {
    modal.hidden = true; modal.innerHTML = ''; document.body.style.overflow = '';
    modal._opener?.focus?.();
  }

  // ---------- events ----------
  // ---------- toolbar controls ----------
  const defaultDesc = (key) => SORTS[key].dir === -1;
  let minRaf = 0;
  function setMin(v) {
    const { lo } = state.range, nv = v <= lo + 0.001 ? 0 : Math.round(v * 10) / 10;
    if (nv === state.minScore) return;
    state.minScore = nv;
    syncControls();                 // thumb + bars follow the pointer immediately
    cancelAnimationFrame(minRaf);   // results catch up at most once per frame
    minRaf = requestAnimationFrame(renderResults);
  }
  function setSort(key, desc) { state.sort = key; state.desc = desc ?? defaultDesc(key); renderResults(); }
  function closePops() {
    app.querySelectorAll('.pop').forEach((p) => (p.hidden = true));
    app.querySelectorAll('.tb-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  function togglePop(name) {
    const pop = $(`#${name}Pop`), wasHidden = pop.hidden;
    closePops();
    if (wasHidden) { pop.hidden = false; $(`#${name}Btn`).setAttribute('aria-expanded', 'true'); }
  }
  // Update control state in place (never re-render the popovers: a slider mid-drag must keep focus).
  function syncControls() {
    const min = state.minScore, { lo, hi } = state.range;
    const r = $('#scoreRange');
    if (r) {
      const v = min || lo, p = (v - lo) / (hi - lo);
      r.value = v;
      const t = $('#scoreThumb');
      t.textContent = min ? `${min.toFixed(1)}+` : 'Any';
      t.parentElement.style.setProperty('--p', p);
      t.parentElement.style.setProperty('--pct', `${p * 100}%`);
      $('#scoref').classList.toggle('is-set', !!min);
      app.querySelectorAll('[data-bmin]').forEach((b) => b.classList.toggle('on', +b.dataset.bmin + 0.5 > min + 1e-9));
    }
    $('#sortLabel').textContent = SORTS[state.sort].label;
    $('#sortArrow').innerHTML = state.desc ? GLYPH.down : GLYPH.up;
    app.querySelectorAll('[data-sortkey]').forEach((b) => b.setAttribute('aria-checked', b.dataset.sortkey === state.sort));
    app.querySelectorAll('[data-order]').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.order === 'desc') === state.desc));
    app.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === state.view));
    $('#gemsBtn')?.setAttribute('aria-pressed', state.gemsOnly);
    $('#clearAll').hidden = !filtersActive();
  }

  function wire() {
    $('#descToggle')?.addEventListener('click', () => { state.descOpen = !state.descOpen; render(); });
    $('#refresh').addEventListener('click', (ev) => { ev.preventDefault(); load(state.data.id, true); });
    $('#q').addEventListener('input', (ev) => { state.q = ev.target.value; renderResults(); });
    $('#q').addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { if (ev.target.value) { ev.target.value = ''; state.q = ''; renderResults(); } else ev.target.blur(); } });
    $('#sortBtn').addEventListener('click', () => togglePop('sort'));
    $('#gemsBtn')?.addEventListener('click', () => { state.gemsOnly = !state.gemsOnly; renderResults(); });
    const sf = $('#scoref'), sr = $('#scoreRange');
    if (sr) {
      let hideT = 0;
      const show = () => { clearTimeout(hideT); sf.classList.toggle('below', sr.getBoundingClientRect().top < 110); sf.classList.add('live'); };
      const hide = (ms = 700) => { clearTimeout(hideT); hideT = setTimeout(() => sf.classList.remove('live'), ms); };
      sr.addEventListener('input', (ev) => { show(); setMin(+ev.target.value); });
      sr.addEventListener('pointerdown', show);
      sr.addEventListener('keydown', show);
      sr.addEventListener('blur', () => hide(0));
      ['pointerup', 'pointercancel'].forEach((t) => window.addEventListener(t, () => sf.classList.contains('live') && hide(), { passive: true }));
    }
    app.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      state.view = b.dataset.view; store.set('sv-view', state.view);
      syncControls();
      renderResults();
    }));
  }

  // delegated handlers (results re-render often)
  app.addEventListener('click', (ev) => {
    const g = ev.target.closest('[data-genre]');
    if (g) {
      const name = g.dataset.genre;
      state.genres.has(name) ? state.genres.delete(name) : state.genres.add(name);
      return renderResults();
    }
    if (ev.target.closest('#moreGenres')) { state.allGenres = !state.allGenres; return renderGenres(); }
    if (ev.target.closest('#clearGenres')) { state.genres.clear(); return renderResults(); }
    const mode = ev.target.closest('[data-mode]');
    if (mode) { state.genreMode = mode.dataset.mode; return renderResults(); }
    const sk = ev.target.closest('[data-sortkey]');
    if (sk) return setSort(sk.dataset.sortkey);
    const ord = ev.target.closest('[data-order]');
    if (ord) return setSort(state.sort, ord.dataset.order === 'desc');
    if (ev.target.closest('#clearAll, #clearAllEmpty')) {
      Object.assign(state, { q: '', minScore: 0, genres: new Set(), gemsOnly: false });
      $('#q').value = '';
      return renderResults();
    }
    const th = ev.target.closest('th[data-sort]');
    if (th) {
      const k = th.dataset.sort;
      return state.sort === k ? setSort(k, !state.desc) : setSort(k);
    }
    const o = ev.target.closest('[data-open]');
    if (o && !ev.target.closest('a')) openDetail(+o.dataset.open);
  });
  app.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-open]')) { ev.preventDefault(); openDetail(+ev.target.dataset.open); }
  });
  document.addEventListener('click', (ev) => { if (!ev.target.closest?.('.dd')) closePops(); });
  modal.addEventListener('click', (ev) => { if (ev.target === modal || ev.target.closest('.close')) closeDetail(); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && app.querySelector('.pop:not([hidden])')) { const b = app.querySelector('.tb-btn[aria-expanded="true"]'); closePops(); b?.focus(); return; }
    if (ev.key === 'Escape' && !modal.hidden) closeDetail();
    if (ev.key === '/' && !ev.metaKey && !ev.ctrlKey && !ev.altKey && modal.hidden && !ev.target.closest?.('input, select, textarea') && $('#q')) {
      ev.preventDefault(); $('#q').focus(); $('#q').select();
    }
  });

  $('#load').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const id = parseInput($('#stackInput').value);
    if (!id) { $('#stackInput').setCustomValidity('Enter a MAL stack link or numeric ID'); $('#stackInput').reportValidity(); return; }
    load(id);
  });
  $('#stackInput').addEventListener('input', (ev) => ev.target.setCustomValidity(''));

  // theme
  const root = document.documentElement;
  const saved = store.get('sv-theme');
  if (saved) root.dataset.theme = saved;
  $('#themeBtn').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    store.set('sv-theme', root.dataset.theme);
  });

  // boot
  const initial = parseInput(new URLSearchParams(location.search).get('stack') || '');
  if (initial) { $('#stackInput').value = `https://myanimelist.net/stacks/${initial}`; load(initial); }
})();
