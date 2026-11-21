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

  // ---------- state ----------
  const GENRES_SHOWN = 10;
  const state = {
    data: null,
    view: store.get('sv-view') || 'cards',
    q: '',
    genres: new Set(),
    allGenres: false,
    format: '',
    sort: 'stack',
    dir: 1,
    descOpen: false,
  };

  const SORTS = {
    stack: { label: 'Stack order', get: (e) => e._i, dir: 1 },
    title: { label: 'Title', get: (e) => (e.english || e.title).toLowerCase(), dir: 1 },
    score: { label: 'MAL score', get: (e) => e.malScore ?? -1, dir: -1 },
    members: { label: 'Members', get: (e) => e.members ?? -1, dir: -1 },
    year: { label: 'Year', get: (e) => e.year ?? 0, dir: -1 },
    length: { label: 'Length', get: (e) => lengthMin(e), dir: -1 },
    episodes: { label: 'Episodes', get: (e) => (e.episodes ?? e.chapters ?? -1), dir: -1 },
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
  const STATUS = { FINISHED: ['Finished', ''], RELEASING: ['Airing', 'live'], 'NOT YET RELEASED': ['Upcoming', 'soon'], CANCELLED: ['Cancelled', ''], HIATUS: ['Hiatus', 'soon'] };
  const statusDot = (e) => {
    if (!e.status) return '';
    const [label, cls] = STATUS[e.status] || [e.status, ''];
    return `<span class="status-dot ${cls}">${esc(label)}</span>`;
  };
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
      data.entries.forEach((e, i) => (e._i = i));
      Object.assign(state, { data, q: '', genres: new Set(), allGenres: false, format: '', sort: 'stack', dir: 1, descOpen: false });
      document.title = `${data.title} · Stack Viewer`;
      history.replaceState(null, '', `?stack=${id}`);
      render();
    } catch (err) {
      app.innerHTML = `<div class="status err"><b>Couldn't load that stack.</b><br>${esc(err.message)}</div>`;
    }
  }

  // ---------- derived ----------
  function visible() {
    const { data, q, genres, format, sort, dir } = state;
    const needle = q.trim().toLowerCase();
    let list = data.entries.filter((e) => {
      if (format && e.format !== format) return false;
      for (const g of genres) if (!e.genres.includes(g)) return false;
      if (!needle) return true;
      const hay = [e.title, e.english, e.romaji, e.studio, ...e.genres, ...e.tags.map((t) => t.name)].join(' ').toLowerCase();
      return hay.includes(needle);
    });
    const s = SORTS[sort];
    return [...list].sort((a, b) => {
      const x = s.get(a), y = s.get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * s.dir * dir || a._i - b._i;
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
    const stat = (l, v, sub = '', cls = '') => `<div class="stat"><dt>${l}</dt><dd class="${cls}">${v}</dd>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;

    app.innerHTML = `
      <section class="head">
        <div class="head-top">
          <div>
            <div class="eyebrow"><span class="kind">${isAnime ? 'Anime' : 'Manga'} stack</span>
              <span>by <a href="${esc(data.authorUrl)}" target="_blank" rel="noopener">${esc(data.author)}</a></span>
              <span>· Updated ${esc(data.updated)}</span><span>· ${fmtNum(data.restacks)} restacks</span></div>
            <h2>${esc(data.title)}</h2>
          </div>
          <div class="head-actions">
            <a class="btn ghost" href="${esc(data.url)}" target="_blank" rel="noopener">Open on MAL ↗</a>
            <button class="btn ghost" id="refresh" type="button">↻ Refresh</button>
          </div>
        </div>
        ${data.description ? `<p class="desc ${descLong && !state.descOpen ? 'clamp' : ''}">${esc(data.description)}</p>${descLong ? `<button class="linklike" id="descToggle" type="button">${state.descOpen ? 'Show less' : 'Read more'}</button>` : ''}` : ''}
        <dl class="strip">
          ${stat('Entries', es.length, formatCounts.map(([f, c]) => `${esc(f)} ${c}`).join(' · '))}
          ${isAnime
            ? stat('Episodes', fmtNum(totalEps)) + stat('Runtime', fmtHours(totalMin), totalMin > 0 ? `≈ ${Math.round(totalMin / 60)} hours` : '')
            : stat('Chapters', fmtNum(totalCh))}
          ${stat('Avg score', avg ? avg.toFixed(2) : '—', `of ${scores.length} rated`, scoreCls(avg))}
          ${stat('Years', years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—', esc(topGenres))}
          ${stat('Top rated', best?.malScore?.toFixed(2) ?? '—', esc(best ? titleOf(best) : ''), scoreCls(best?.malScore))}
        </dl>
      </section>

      <div class="toolbar">
        <input type="search" id="q" placeholder="Search title, studio, tag…" value="${esc(state.q)}" aria-label="Filter entries">
        <select id="fmt" aria-label="Format"><option value="">All formats</option>${formatCounts.map(([f, c]) => `<option ${state.format === f ? 'selected' : ''} value="${esc(f)}">${esc(f)} (${c})</option>`).join('')}</select>
        <select id="sort" aria-label="Sort by">${Object.entries(SORTS).map(([k, s]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>Sort: ${s.label}</option>`).join('')}</select>
        <button class="icon-btn" id="dir" title="Reverse order" aria-label="Reverse order">${state.dir === 1 ? '↓' : '↑'}</button>
        <div class="seg" role="group" aria-label="View">
          <button data-view="cards" aria-pressed="${state.view === 'cards'}">Cards</button>
          <button data-view="table" aria-pressed="${state.view === 'table'}">Table</button>
        </div>
        <span class="count" id="count" aria-live="polite"></span>
      </div>
      <div class="genre-row" id="genreRow"></div>
      <div id="results"></div>`;

    wire();
    renderGenres();
    renderResults();
  }

  function renderGenres() {
    const all = tally(state.data.entries, (e) => e.genres);
    const shown = state.allGenres ? all : all.filter(([g], i) => i < GENRES_SHOWN || state.genres.has(g));
    const hidden = all.length - shown.length;
    $('#genreRow').innerHTML =
      shown.map(([g, c]) => `<button class="pill" data-genre="${esc(g)}" aria-pressed="${state.genres.has(g)}">${esc(g)}<small>${c}</small></button>`).join('') +
      (hidden > 0 ? `<button class="pill more" id="moreGenres" type="button">+${hidden} more</button>` : state.allGenres && all.length > GENRES_SHOWN ? '<button class="pill more" id="moreGenres" type="button">Show fewer</button>' : '') +
      (state.genres.size ? '<button class="pill clear" id="clearGenres" type="button">Clear filters</button>' : '');
  }

  function renderResults() {
    const list = visible();
    $('#count').textContent = `${list.length} of ${state.data.entries.length}`;
    const box = $('#results');
    if (!list.length) { box.innerHTML = '<div class="status">Nothing matches those filters.</div>'; return; }
    box.innerHTML = state.view === 'table' ? tableHTML(list) : `<div class="cards">${list.map(cardHTML).join('')}</div>`;
  }

  const scoreBadge = (e) => (e.malScore != null
    ? `<span class="badge score ${scoreCls(e.malScore)}" title="MyAnimeList score">${ICON.star}${e.malScore.toFixed(2)}</span>`
    : '<span class="badge none" title="No MyAnimeList score yet">Unrated</span>');

  function cardHTML(e) {
    const topTags = e.tags.filter((t) => !t.spoiler).slice(0, 5).map((t) => t.name);
    return `<article class="acard" data-open="${e._i}" tabindex="0" role="button" aria-label="${esc(titleOf(e))} details">
      <div class="poster"><img loading="lazy" src="${esc(e.cover || e.image)}" alt=""><span class="rank">${e._i + 1}</span>${scoreBadge(e)}</div>
      <div class="body">
        <h4>${esc(titleOf(e))}</h4>
        ${altTitle(e) ? `<div class="alt">${esc(altTitle(e))}</div>` : ''}
        <div class="line sep">
          ${e.format ? `<span><span class="fmt-chip">${esc(e.format)}</span></span>` : ''}
          ${e.year ? `<span>${e.year}</span>` : ''}
          ${lenText(e) ? `<span>${esc(lenText(e))}</span>` : ''}
          ${e.studio ? `<span>${esc(e.studio)}</span>` : ''}
        </div>
        <div class="line dim sep">
          ${statusDot(e) ? `<span>${statusDot(e)}</span>` : ''}
          <span title="MyAnimeList members">${ICON.users} ${short(e.members)}</span>
          ${e.source ? `<span>${esc(cap(e.source))}</span>` : ''}
        </div>
        <div class="genres">${e.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>
        ${e.synopsis ? `<p class="syn">${esc(e.synopsis)}</p>` : ''}
        ${topTags.length ? `<div class="tagline">${esc(topTags.join(' · '))}</div>` : ''}
      </div></article>`;
  }

  function tableHTML(list) {
    const isManga = state.data.kind === 'manga';
    const cols = [
      ['#', 'stack', 'num'], ['Title', 'title'], ['Format'], ['Year', 'year', 'num'],
      [isManga ? 'Chapters' : 'Eps', 'episodes', 'num'], ...(isManga ? [] : [['Runtime', 'length', 'num']]),
      ...(isManga ? [] : [['Studio']]), ['Score', 'score', 'num'], ['Members', 'members', 'num'], ['Status'], ['Genres'],
    ];
    const th = cols.map(([label, key, cls]) => {
      const on = key && state.sort === key;
      return `<th class="${cls || ''}" ${key ? `data-sort="${key}"` : ''} ${on ? `aria-sort="${state.dir === 1 ? 'ascending' : 'descending'}"` : ''}>${label}${on ? `<span class="ar">${state.dir === 1 ? '▲' : '▼'}</span>` : ''}</th>`;
    }).join('');
    const rows = list.map((e) => `<tr data-open="${e._i}" tabindex="0">
      <td class="num">${e._i + 1}</td>
      <td><div class="tcell"><img loading="lazy" src="${esc(e.cover || e.image)}" alt=""><div><b>${esc(titleOf(e))}</b><small>${esc(altTitle(e))}</small></div></div></td>
      <td><span class="fmt-chip">${esc(e.format || '—')}</span></td>
      <td class="num">${e.year ?? '—'}</td>
      <td class="num">${(isManga ? e.chapters : e.episodes) ?? '?'}</td>
      ${isManga ? '' : `<td class="num">${fmtHours(lengthMin(e))}</td>`}
      ${isManga ? '' : `<td>${esc(e.studio || '—')}</td>`}
      <td class="num"><span class="score ${scoreCls(e.malScore)}">${e.malScore?.toFixed(2) ?? '—'}</span></td>
      <td class="num">${fmtNum(e.members)}</td>
      <td>${statusDot(e) || '—'}</td>
      <td><div class="genres">${e.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div></td></tr>`).join('');
    return `<div class="tablewrap"><table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- detail modal ----------
  function openDetail(i) {
    const e = state.data.entries[i];
    if (!e) return;
    const isManga = e.kind === 'manga';
    const air = e.startDate?.year ? [e.startDate.year, e.startDate.month, e.startDate.day].filter(Boolean).join('-') : e.year;
    const fact = (l, v) => (v || v === 0 ? `<div class="fact"><span>${l}</span><b>${v}</b></div>` : '');
    const epText = isManga ? (e.chapters ? `${e.chapters} ch` : '') : e.episodes != null ? `${e.episodes}${e.duration ? ` × ${e.duration}m` : ''}` : '';

    // tags: top 12 visible, rest behind "+N more"; spoiler tags behind their own toggle
    const TAGS_SHOWN = 12;
    const tags = [...e.tags].sort((a, b) => b.rank - a.rank);
    const plain = tags.filter((t) => !t.spoiler);
    const spoil = tags.filter((t) => t.spoiler);
    const tagChip = (t, attr = '') => `<span class="chip tagchip" style="--r:${t.rank}" ${attr}>${esc(t.name)}<small>${t.rank}%</small></span>`;

    // AniList appends "(Source: …)" to descriptions — show it as a quiet credit line
    const syn = (e.synopsis || '').trim();
    const m = syn.match(/^([\s\S]*?)\s*\n\s*\((Source:[^)]*)\)\s*$/);
    const body = m ? m[1] : syn;
    const credit = m ? m[2] : '';

    modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titleOf(e))}" style="${e.banner ? `--banner:url('${esc(e.banner)}')` : e.color ? `--tint:${esc(e.color)}` : ''}">
      <button class="close" aria-label="Close">✕</button>
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
          <a href="${esc(e.url)}" target="_blank" rel="noopener">MyAnimeList ↗</a>
          ${e.alUrl ? `<a href="${esc(e.alUrl)}" target="_blank" rel="noopener">AniList ↗</a>` : ''}
          ${e.trailer ? `<a href="${esc(e.trailer)}" target="_blank" rel="noopener">▶ Trailer</a>` : ''}
        </div>
      </aside>
      <section class="main">
        <h3>${esc(titleOf(e))}</h3>
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
          <p class="syn-full">${esc(body || 'No synopsis available.')}</p>
          ${credit ? `<div class="credit">${esc(credit)}</div>` : ''}
        </div>
        ${tags.length ? `<div class="tagblock"><h5>Tags</h5><div class="genres" id="tagbox">
          ${plain.map((t, k) => tagChip(t, k >= TAGS_SHOWN ? 'data-more hidden' : '')).join('')}
          ${spoil.map((t) => tagChip(t, 'data-spoiler hidden')).join('')}
          ${plain.length > TAGS_SHOWN ? `<button class="linklike" id="moreTags" type="button">+${plain.length - TAGS_SHOWN} more</button>` : ''}
          ${spoil.length ? `<button class="linklike" id="spoil" type="button">Show ${spoil.length} spoiler tag${spoil.length === 1 ? '' : 's'}</button>` : ''}
        </div></div>` : ''}
      </section></div>`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal._opener = document.activeElement;
    $('.close', modal).focus();
    const reveal = (btn, sel) => btn && (btn.onclick = () => { modal.querySelectorAll(sel).forEach((n) => (n.hidden = false)); btn.remove(); });
    reveal($('#moreTags', modal), '[data-more]');
    reveal($('#spoil', modal), '[data-spoiler]');
  }
  function closeDetail() {
    modal.hidden = true; modal.innerHTML = ''; document.body.style.overflow = '';
    modal._opener?.focus?.();
  }

  // ---------- events ----------
  function wire() {
    $('#descToggle')?.addEventListener('click', () => { state.descOpen = !state.descOpen; render(); });
    $('#refresh').addEventListener('click', (ev) => { ev.preventDefault(); load(state.data.id, true); });
    $('#q').addEventListener('input', (ev) => { state.q = ev.target.value; renderResults(); });
    $('#fmt').addEventListener('change', (ev) => { state.format = ev.target.value; renderResults(); });
    $('#sort').addEventListener('change', (ev) => { state.sort = ev.target.value; state.dir = 1; $('#dir').textContent = '↓'; renderResults(); });
    $('#dir').addEventListener('click', (ev) => { state.dir *= -1; ev.currentTarget.textContent = state.dir === 1 ? '↓' : '↑'; renderResults(); });
    app.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      state.view = b.dataset.view; store.set('sv-view', state.view);
      app.querySelectorAll('[data-view]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      renderResults();
    }));
  }

  // delegated handlers (results re-render often)
  app.addEventListener('click', (ev) => {
    const g = ev.target.closest('[data-genre]');
    if (g) {
      const name = g.dataset.genre;
      state.genres.has(name) ? state.genres.delete(name) : state.genres.add(name);
      renderGenres(); return renderResults();
    }
    if (ev.target.closest('#moreGenres')) { state.allGenres = !state.allGenres; return renderGenres(); }
    if (ev.target.closest('#clearGenres')) { state.genres.clear(); renderGenres(); return renderResults(); }
    const th = ev.target.closest('th[data-sort]');
    if (th) {
      const k = th.dataset.sort;
      if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = 1; }
      $('#sort').value = k; $('#dir').textContent = state.dir === 1 ? '↓' : '↑';
      return renderResults();
    }
    const o = ev.target.closest('[data-open]');
    if (o && !ev.target.closest('a')) openDetail(+o.dataset.open);
  });
  app.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-open]')) { ev.preventDefault(); openDetail(+ev.target.dataset.open); }
  });
  modal.addEventListener('click', (ev) => { if (ev.target === modal || ev.target.closest('.close')) closeDetail(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !modal.hidden) closeDetail(); });

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
