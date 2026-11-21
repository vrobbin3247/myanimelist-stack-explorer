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

  // ---------- state ----------
  const state = {
    data: null,
    view: store.get('sv-view') || 'cards',
    q: '',
    genres: new Set(),
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
  const statusChip = (e) => {
    if (!e.status) return '';
    const cls = e.status === 'RELEASING' ? 'st-releasing' : e.status === 'NOT YET RELEASED' ? 'st-notyet' : '';
    const label = { FINISHED: 'Finished', RELEASING: 'Airing', 'NOT YET RELEASED': 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'Hiatus' }[e.status] || e.status;
    return `<span class="chip ${cls}">${esc(label)}</span>`;
  };

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
      Object.assign(state, { data, q: '', genres: new Set(), format: '', sort: 'stack', dir: 1, descOpen: false });
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
    list = [...list].sort((a, b) => {
      const x = s.get(a), y = s.get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * s.dir * dir || a._i - b._i;
    });
    return list;
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

    const genreCounts = tally(es, (e) => e.genres);
    const formatCounts = tally(es, (e) => e.format);
    const studioCounts = tally(es, (e) => e.studio).slice(0, 6);
    const maxG = genreCounts[0]?.[1] || 1;

    const descLong = data.description.length > 260;
    app.innerHTML = `
      <section class="hero">
        <div class="hero-main">
          <div class="byline"><span class="chip fmt">${isAnime ? 'Anime' : 'Manga'} stack</span>
            by <a href="${esc(data.authorUrl)}" target="_blank" rel="noopener">${esc(data.author)}</a>
            · updated ${esc(data.updated)} · ${fmtNum(data.restacks)} restacks</div>
          <h2>${esc(data.title)}</h2>
          ${data.description ? `<p class="desc ${descLong && !state.descOpen ? 'clamp' : ''}">${esc(data.description)}</p>${descLong ? `<button class="linklike" id="descToggle">${state.descOpen ? 'Show less' : 'Read more'}</button>` : ''}` : ''}
          <div class="links"><a href="${esc(data.url)}" target="_blank" rel="noopener">Open on MyAnimeList ↗</a>
            <a href="#" id="refresh">↻ Refresh data</a></div>
        </div>
        <div>
          <div class="stats">
            <div class="tile"><div class="l">Entries</div><div class="v">${es.length}</div></div>
            ${isAnime ? `
              <div class="tile"><div class="l">Episodes</div><div class="v">${fmtNum(totalEps)}</div></div>
              <div class="tile"><div class="l">Total runtime</div><div class="v">${fmtHours(totalMin)}</div><div class="s">${totalMin > 0 ? `≈ ${Math.round(totalMin / 60)} hours` : ''}</div></div>`
              : `<div class="tile"><div class="l">Chapters</div><div class="v">${fmtNum(totalCh)}</div></div>`}
            <div class="tile"><div class="l">Avg MAL score</div><div class="v">${avg ? avg.toFixed(2) : '—'}</div></div>
            <div class="tile"><div class="l">Years</div><div class="v">${years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—'}</div></div>
            <div class="tile"><div class="l">Top rated</div><div class="v score ${scoreCls(best?.malScore)}">${best?.malScore?.toFixed(2) ?? '—'}</div><div class="s">${esc(best ? titleOf(best) : '')}</div></div>
          </div>
          <div class="insights">
            <div class="card-box"><h3>Genres <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— click to filter</span></h3>
              <div class="bars">${genreCounts.slice(0, 5).map(([g, c]) => bar(g, c, maxG, state.genres.has(g))).join('')}</div></div>
            <div class="card-box"><h3>Format</h3>
              <div class="bars">${formatCounts.map(([g, c]) => `<div class="bar" style="cursor:default"><span class="n">${esc(g)}</span><span class="t"><i style="width:${(c / es.length) * 100}%"></i></span><span class="c">${c}</span></div>`).join('')}</div>
              ${studioCounts.length > 1 && studioCounts[0][1] > 1 ? `<h3 style="margin-top:12px">Top studios</h3><div class="genres">${studioCounts.filter((s) => s[1] > 1).map(([s, c]) => `<span class="chip">${esc(s)} <small>×${c}</small></span>`).join('')}</div>` : ''}
            </div>
          </div>
        </div>
      </section>

      <div class="toolbar">
        <input type="search" id="q" placeholder="Search title, studio, tag…" value="${esc(state.q)}" aria-label="Filter entries">
        <select id="fmt" aria-label="Format"><option value="">All formats</option>${formatCounts.map(([f, c]) => `<option ${state.format === f ? 'selected' : ''} value="${esc(f)}">${esc(f)} (${c})</option>`).join('')}</select>
        <select id="sort" aria-label="Sort by">${Object.entries(SORTS).map(([k, s]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>Sort: ${s.label}</option>`).join('')}</select>
        <button class="icon-btn" id="dir" style="margin:0" title="Reverse order" aria-label="Reverse order">${state.dir === 1 ? '↓' : '↑'}</button>
        <div class="seg" role="group" aria-label="View">
          <button data-view="cards" aria-pressed="${state.view === 'cards'}">Cards</button>
          <button data-view="table" aria-pressed="${state.view === 'table'}">Table</button>
        </div>
        <span class="count" id="count"></span>
      </div>
      <div class="genre-row" id="genreRow">${genreCounts.map(([g, c]) => `<button class="pill" data-genre="${esc(g)}" aria-pressed="${state.genres.has(g)}">${esc(g)}<small>${c}</small></button>`).join('')}</div>
      <div id="results"></div>`;

    wire();
    renderResults();
  }

  const bar = (name, c, max, on) => `<button class="bar ${on ? 'on' : ''}" data-genre="${esc(name)}"><span class="n">${esc(name)}</span><span class="t"><i style="width:${(c / max) * 100}%"></i></span><span class="c">${c}</span></button>`;

  function renderResults() {
    const list = visible();
    $('#count').textContent = `${list.length} of ${state.data.entries.length}`;
    const box = $('#results');
    if (!list.length) { box.innerHTML = '<div class="status">Nothing matches those filters.</div>'; return; }
    box.innerHTML = state.view === 'table' ? tableHTML(list) : `<div class="cards">${list.map(cardHTML).join('')}</div>`;
    // keep genre highlights in sync
    document.querySelectorAll('[data-genre]').forEach((b) => {
      const on = state.genres.has(b.dataset.genre);
      b.classList.toggle('on', on && b.classList.contains('bar'));
      if (b.classList.contains('pill')) b.setAttribute('aria-pressed', on);
    });
  }

  function cardHTML(e) {
    const topTags = e.tags.filter((t) => !t.spoiler).slice(0, 5).map((t) => t.name);
    const meta = [
      e.format && `<span class="chip fmt">${esc(e.format)}</span>`,
      e.year && `<span>${e.year}</span>`,
      lenText(e) && `<span class="dot">${esc(lenText(e))}</span>`,
      e.studio && `<span class="dot">${esc(e.studio)}</span>`,
    ].filter(Boolean).join('');
    return `<article class="acard" data-open="${e._i}" tabindex="0" role="button" aria-label="${esc(titleOf(e))} details">
      <div class="poster"><img loading="lazy" src="${esc(e.cover || e.image)}" alt=""><span class="rank">#${e._i + 1}</span></div>
      <div class="body">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <h4>${esc(titleOf(e))}</h4>
          <span class="score ${scoreCls(e.malScore)}" title="MAL score">★ ${e.malScore?.toFixed(2) ?? '—'}</span>
        </div>
        ${altTitle(e) ? `<div class="alt">${esc(altTitle(e))}</div>` : ''}
        <div class="meta">${meta}</div>
        <div class="meta">${statusChip(e)}<span title="MAL members">👥 ${short(e.members)}</span>${e.source ? `<span class="dot">Source: ${esc(e.source.toLowerCase())}</span>` : ''}</div>
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
      <td><span class="chip fmt">${esc(e.format || '—')}</span></td>
      <td class="num">${e.year ?? '—'}</td>
      <td class="num">${(isManga ? e.chapters : e.episodes) ?? '?'}</td>
      ${isManga ? '' : `<td class="num">${fmtHours(lengthMin(e))}</td>`}
      ${isManga ? '' : `<td>${esc(e.studio || '—')}</td>`}
      <td class="num"><span class="score ${scoreCls(e.malScore)}">${e.malScore?.toFixed(2) ?? '—'}</span></td>
      <td class="num">${fmtNum(e.members)}</td>
      <td>${statusChip(e) || '—'}</td>
      <td><div class="genres">${e.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div></td></tr>`).join('');
    return `<div class="tablewrap"><table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- detail modal ----------
  function openDetail(i) {
    const e = state.data.entries[i];
    if (!e) return;
    const tags = e.tags;
    const air = e.startDate?.year ? [e.startDate.year, e.startDate.month, e.startDate.day].filter(Boolean).join('-') : e.year;
    const fact = (l, v) => (v || v === 0 ? `<div><span>${l}</span>${v}</div>` : '');
    modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titleOf(e))}">
      <div class="banner" style="${e.banner ? `background-image:url('${esc(e.banner)}')` : e.color ? `background:${esc(e.color)}` : ''}"></div>
      <button class="close" aria-label="Close">✕</button>
      <div class="inner">
        <img class="cover" src="${esc(e.cover || e.image)}" alt="">
        <div>
          <h3>${esc(titleOf(e))}</h3>
          <div class="jp">${esc([e.romaji !== titleOf(e) ? e.romaji : '', e.native].filter(Boolean).join(' · '))}</div>
          <div class="meta"><span class="score ${scoreCls(e.malScore)}">★ ${e.malScore?.toFixed(2) ?? '—'} MAL</span>
            ${e.alScore ? `<span class="dot">${e.alScore.toFixed(1)} AniList</span>` : ''}<span class="dot">👥 ${fmtNum(e.members)}</span>${e.favourites ? `<span class="dot">♥ ${fmtNum(e.favourites)}</span>` : ''}</div>
          <div class="facts">
            ${fact('Format', esc(e.format))}${fact('Status', esc(e.status && e.status[0] + e.status.slice(1).toLowerCase()))}
            ${fact('Aired', esc(air))}${fact('Season', esc(e.season ? e.season[0] + e.season.slice(1).toLowerCase() + ' ' + (e.year || '') : ''))}
            ${fact(e.kind === 'manga' ? 'Chapters' : 'Episodes', e.kind === 'manga' ? e.chapters : e.episodes)}${fact('Per episode', e.duration ? e.duration + ' min' : '')}
            ${fact('Total runtime', lengthMin(e) > 0 ? fmtHours(lengthMin(e)) : '')}${fact('Studio', esc(e.studio))}
            ${fact('Source', esc(e.source && e.source[0] + e.source.slice(1).toLowerCase()))}
            ${e.nextEpisode ? fact('Next episode', `Ep ${e.nextEpisode.episode} · ${new Date(e.nextEpisode.airingAt * 1000).toLocaleDateString()}`) : ''}
          </div>
          <div class="genres">${e.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>
          <p class="syn-full">${esc(e.synopsis || 'No synopsis available.')}</p>
          ${tags.length ? `<h5>Tags</h5><div class="genres" id="tagbox">${tags.map((t) => `<span class="chip tagchip" style="--r:${t.rank}" ${t.spoiler ? 'data-spoiler hidden' : ''}>${esc(t.name)}<small>${t.rank}%</small></span>`).join('')}</div>
            ${tags.some((t) => t.spoiler) ? '<button class="linklike" id="spoil">Show spoiler tags</button>' : ''}` : ''}
          <div class="links">
            <a href="${esc(e.url)}" target="_blank" rel="noopener">MyAnimeList ↗</a>
            ${e.alUrl ? `<a href="${esc(e.alUrl)}" target="_blank" rel="noopener">AniList ↗</a>` : ''}
            ${e.trailer ? `<a href="${esc(e.trailer)}" target="_blank" rel="noopener">▶ Trailer</a>` : ''}
          </div>
        </div>
      </div></div>`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal._opener = document.activeElement;
    $('.close', modal).focus();
    const sp = $('#spoil', modal);
    if (sp) sp.onclick = () => { modal.querySelectorAll('[data-spoiler]').forEach((n) => (n.hidden = false)); sp.remove(); };
  }
  function closeDetail() {
    modal.hidden = true; modal.innerHTML = ''; document.body.style.overflow = '';
    modal._opener?.focus?.();
  }

  // ---------- events ----------
  function toggleGenre(g) {
    state.genres.has(g) ? state.genres.delete(g) : state.genres.add(g);
    $('#genreRow')?.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-pressed', state.genres.has(p.dataset.genre)));
    renderResults();
  }

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
    if (g) return toggleGenre(g.dataset.genre);
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
