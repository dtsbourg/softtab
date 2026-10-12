(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const root = document.documentElement;
  const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage;
  // Optional personal defaults from defaults.local.js (git-ignored), used instead of the public ones below.
  const LOCAL_DEFAULTS = window.SOFTTAB_LOCAL_DEFAULTS || {};

  /* ---------- Storage ---------- */
  const local = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  const synced = {
    async get(k) { if (!hasChrome) return undefined; try { return (await chrome.storage.sync.get(k))[k]; } catch { return undefined; } },
    async set(k, v) { if (hasChrome) try { await chrome.storage.sync.set({ [k]: v }); } catch {} },
    async del(k) { if (hasChrome) try { await chrome.storage.sync.remove(k); } catch {} }
  };
  const secret = {
    async get(k) { if (!hasChrome) return local.get(k, ''); try { return (await chrome.storage.local.get(k))[k] || ''; } catch { return ''; } },
    async set(k, v) { if (!hasChrome) return local.set(k, v); try { await chrome.storage.local.set({ [k]: v }); } catch {} }
  };

  /* ---------- Helpers ---------- */
  const HOME_TZ = 'America/New_York';
  function partsIn(tz, date = new Date()) {
    const p = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long', day: 'numeric', month: 'long'
    }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
    return p;
  }
  function offsetMinutes(tz, date = new Date()) {
    const at = zone => new Date(date.toLocaleString('en-US', { timeZone: zone }));
    return Math.round((at(tz) - at('UTC')) / 60000);
  }
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const nyClock = new Intl.DateTimeFormat('en-US', { timeZone: HOME_TZ, hour: 'numeric', minute: '2-digit' });
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  function faviconUrl(u) {
    if (!hasChrome || !chrome.runtime?.getURL) return null;
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    url.searchParams.set('pageUrl', u);
    url.searchParams.set('size', '64');
    return url.toString();
  }
  const initials = name => {
    const w = name.trim().split(/\s+/);
    return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : w[0].slice(0, 2);
  };
  // Bundled marks beat Chrome's favicon cache, which is empty or wrong for sites behind a login.
  const GLYPHS = {
    deploy: '<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15l-3-3c1.6-4.3 4.7-7.3 8.9-8.4 1.2-.3 2.4-.3 3-.1.2.6.2 1.8-.1 3C19.7 10.7 16.3 13.5 12 15z"/><path d="M9 12H5.2l2.3-3.6h3.8M12 15v3.8l3.6-2.3v-3.8"/><path d="M6.6 16c-1.7.9-2.1 3.9-2.1 3.9s3-.4 3.9-2.1"/><circle cx="15.8" cy="8.2" r="1.4"/></svg>'
  };
  function brandFor(u) {
    const h = host(u);
    if (/(^|\.)github\.com$/.test(h)) return 'github';
    if (/(^|\.)linear\.app$/.test(h)) return 'linear';
    if (h === 'calendar.google.com') return 'calendar';
    if (h === 'mail.google.com') return 'gmail';
    if (h === 'meet.google.com') return 'meet';
    if (/grafana/.test(h)) return 'grafana';
    return null;
  }
  const isDarkHex = hex => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 60;
  };
  const iconFor = (u, name, icon, fallback = initials(name)) => {
    const key = icon || brandFor(u);
    if (GLYPHS[key]) return GLYPHS[key];
    const c = key && typeof COLOR_ICONS !== 'undefined' && COLOR_ICONS[key];
    if (c) return `<svg class="brand" viewBox="0 0 ${c.w} ${c.h}" aria-hidden="true">${c.body}</svg>`;
    const b = key && typeof BRAND_ICONS !== 'undefined' && BRAND_ICONS[key];
    if (b) return `<svg class="brand" viewBox="0 0 24 24" style="color:${isDarkHex(b.color) ? 'var(--text)' : b.color}" aria-hidden="true"><path fill="currentColor" d="${b.d}"/></svg>`;
    const src = faviconUrl(u);
    return src ? `<img src="${esc(src)}" alt="" data-fav="${esc(fallback)}">` : esc(fallback);
  };
  // Chrome returns a generic globe for sites it has no icon for; swap those for initials.
  const imgSig = img => {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    c.getContext('2d').drawImage(img, 0, 0, 16, 16);
    return c.toDataURL();
  };
  const blankIcon = new Promise(res => {
    const src = faviconUrl('https://softtab-no-icon.invalid/');
    if (!src) return res(null);
    const img = new Image();
    img.onload = () => res(imgSig(img));
    img.onerror = () => res(null);
    img.src = src;
  });
  function fixFavicons(root) {
    $$('img[data-fav]', root).forEach(img => {
      const swap = () => img.replaceWith(document.createTextNode(img.dataset.fav));
      const check = async () => { const blank = await blankIcon; if (blank && imgSig(img) === blank) swap(); };
      if (img.complete && img.naturalWidth) check();
      else { img.addEventListener('load', check, { once: true }); img.addEventListener('error', swap, { once: true }); }
    });
  }
  const xSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ---------- Theme ---------- */
  // The theme button cycles light → dark → system; its icon shows the current setting.
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const THEME_ORDER = ['light', 'dark', 'system'];
  const THEME_NAME = { light: 'Light', dark: 'Dark', system: 'System' };
  let themeSetting = local.get('softtab.theme', 'system');
  function setTheme(v, save = true) {
    themeSetting = THEME_ORDER.includes(v) ? v : 'system';
    if (themeSetting === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', themeSetting);
    if (save) local.set('softtab.theme', themeSetting);
    const next = THEME_ORDER[(THEME_ORDER.indexOf(themeSetting) + 1) % THEME_ORDER.length];
    const btn = $('#theme-btn');
    btn.dataset.setting = themeSetting;
    btn.setAttribute('aria-label', `Theme: ${THEME_NAME[themeSetting]}. Switch to ${THEME_NAME[next]}`);
    btn.title = `${THEME_NAME[themeSetting]} theme`;
  }
  const cycleTheme = () => setTheme(THEME_ORDER[(THEME_ORDER.indexOf(themeSetting) + 1) % THEME_ORDER.length]);
  setTheme(themeSetting, false);
  $('#theme-btn').addEventListener('click', cycleTheme);

  /* ---------- Quiet: clocks + weather ---------- */
  const CITY_DEFAULTS = [
    { id: 'paris', name: 'Paris', tz: 'Europe/Paris', lat: 48.8566, lon: 2.3522 },
    { id: 'ny', name: 'New York', tz: 'America/New_York', lat: 40.7128, lon: -74.006 }
  ];
  let cities = local.get('softtab.cities', null) || structuredClone(CITY_DEFAULTS);
  const saveCities = () => { local.set('softtab.cities', cities); synced.set('cities', cities); };
  const cityEl = id => $(`[data-city="${id}"]`);
  const WX_ICONS = {
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    cloudsun: '<path d="M8 3.5v1.3M3.5 8h1.3M4.8 4.8l.9.9M11.2 4.8l-.9.9"/><path d="M5.6 10.4A3 3 0 1 1 10.9 7"/><path d="M7.5 19.5h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2 2.9 2.9 0 0 0-.8 5.8z"/>',
    cloudmoon: '<path d="M10.8 8.6A3.6 3.6 0 0 1 6.4 4.2a3.9 3.9 0 1 0 4.4 4.4z"/><path d="M7.5 19.5h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2 2.9 2.9 0 0 0-.8 5.8z"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 18.5z"/>',
    rain: '<path d="M7 15h10.5a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2 1.3A3.2 3.2 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    snow: '<path d="M7 15h10.5a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2 1.3A3.2 3.2 0 0 0 7 15z"/><path d="M9 18.5h.01M13 18.5h.01M17 18.5h.01M11 21h.01M15 21h.01" stroke-width="2.4"/>',
    fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
    storm: '<path d="M7 15h10.5a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.2 1.3A3.2 3.2 0 0 0 7 15z"/><path d="M12.5 16l-2 3h3l-2 3"/>'
  };
  function wmo(code, day) {
    if (code <= 1) return [day ? 'sun' : 'moon', code === 0 ? 'Clear' : 'Mostly clear'];
    if (code === 2) return [day ? 'cloudsun' : 'cloudmoon', 'Partly cloudy'];
    if (code === 3) return ['cloud', 'Overcast'];
    if (code === 45 || code === 48) return ['fog', 'Fog'];
    if (code >= 51 && code <= 57) return ['rain', 'Drizzle'];
    if (code >= 61 && code <= 67) return ['rain', 'Rain'];
    if (code >= 71 && code <= 77) return ['snow', 'Snow'];
    if (code >= 80 && code <= 82) return ['rain', 'Showers'];
    if (code === 85 || code === 86) return ['snow', 'Snow showers'];
    if (code >= 95) return ['storm', 'Thunderstorm'];
    return ['cloud', ''];
  }

  function renderCities() {
    const now = new Date();
    const ordered = [...cities].sort((a, b) => offsetMinutes(a.tz, now) - offsetMinutes(b.tz, now));  // west to east
    $('#cities').dataset.count = cities.length;
    $('#cities').innerHTML = ordered.map(c => `
      <article class="card city" data-city="${esc(c.id)}">
        <div class="city-head">
          <span class="city-name">${esc(c.name)}</span><span class="utc" data-utc></span>
          <button class="x city-x" data-rm-city="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">${xSvg}</button>
        </div>
        <div class="clock" data-hm>--:--</div>
        <div class="date" data-date></div>
        <div class="weather" data-wx></div>
        <div class="daylight">
          <div class="track"><span class="day" data-day hidden></span><span class="now" data-now></span></div>
          <div class="track-labels" data-sun></div>
        </div>
      </article>`).join('');
    renderWeather();
    tickQuiet(new Date());
  }
  $('#cities').addEventListener('click', e => {
    const b = e.target.closest('[data-rm-city]'); if (!b) return;
    cities = cities.filter(c => c.id !== b.dataset.rmCity);
    saveCities(); renderCities();
  });

  const cityAddBtn = $('#city-add-btn'), cityBox = $('#city-search'), cityQ = $('#city-q'), cityList = $('#city-results');
  let cityTimer = 0, citySeq = 0, cityHits = [];
  function openCitySearch(open) {
    cityBox.hidden = !open; cityAddBtn.hidden = open;
    cityQ.value = ''; cityList.innerHTML = ''; cityHits = [];
    if (open) cityQ.focus();
  }
  function addCity(x) {
    const id = `${x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.round(x.latitude * 10)}-${Math.round(x.longitude * 10)}`.replace(/[^\w-]/g, '');
    if (!cities.some(c => c.id === id)) {
      cities.push({ id, name: x.name, tz: x.timezone, lat: x.latitude, lon: x.longitude });
      saveCities();
    }
    openCitySearch(false);
    renderCities();
    refreshWeather();
  }
  cityAddBtn.addEventListener('click', e => { e.stopPropagation(); openCitySearch(true); });
  cityQ.addEventListener('input', () => {
    clearTimeout(cityTimer);
    const q = cityQ.value.trim(), seq = ++citySeq;
    if (q.length < 2) { cityList.innerHTML = ''; cityHits = []; return; }
    cityTimer = setTimeout(async () => {
      try {
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: q, count: 5, language: 'en', format: 'json' }));
        const d = await r.json();
        if (seq !== citySeq) return;
        cityHits = (d.results || []).filter(x => x.timezone);
        cityList.innerHTML = cityHits.map((x, i) => `
          <li><button class="city-hit${i === 0 ? ' active' : ''}" data-i="${i}">
            <span>${esc(x.name)}</span><span class="where">${esc([x.admin1, x.country].filter(Boolean).join(', '))}</span>
          </button></li>`).join('') || '<li class="empty">No match</li>';
      } catch {}
    }, 200);
  });
  cityQ.addEventListener('keydown', e => {
    if (e.key === 'Enter' && cityHits[0]) addCity(cityHits[0]);
    if (e.key === 'Escape') openCitySearch(false);
  });
  cityList.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) addCity(cityHits[Number(b.dataset.i)]); });
  document.addEventListener('click', e => { if (!cityBox.hidden && !e.target.closest('.city-add')) openCitySearch(false); });
  synced.get('cities').then(v => {
    if (v && JSON.stringify(v) !== JSON.stringify(cities)) { cities = v; local.set('softtab.cities', v); renderCities(); refreshWeather(); }
  });

  function renderWeather() {
    const cache = local.get('softtab.weather', {});
    cities.forEach(c => {
      const el = cityEl(c.id), w = cache[c.id];
      if (!el || !w) return;
      const [icon, label] = wmo(w.code, w.day);
      $('[data-wx]', el).innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${WX_ICONS[icon]}</svg>
        <span class="temp">${Math.round(w.temp)}°</span><span class="cond">${label}</span>
        <span class="hilo">H ${Math.round(w.hi)}° · L ${Math.round(w.lo)}°</span>`;
      const rise = toMin(w.sunrise) / 1440 * 100, set = toMin(w.sunset) / 1440 * 100;
      const day = $('[data-day]', el);
      day.style.left = rise + '%'; day.style.width = (set - rise) + '%'; day.hidden = false;
      $('[data-sun]', el).innerHTML = `<span>↑ ${w.sunrise}</span><span>↓ ${w.sunset}</span>`;
    });
  }
  async function refreshWeather(force = false) {
    const cache = local.get('softtab.weather', {});
    await Promise.all(cities.map(async c => {
      if (!force && cache[c.id] && Date.now() - cache[c.id].at < 15 * 60e3) return;
      try {
        const q = new URLSearchParams({
          latitude: c.lat, longitude: c.lon, timezone: c.tz, forecast_days: 1,
          current: 'temperature_2m,weather_code,is_day',
          daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset'
        });
        const r = await fetch('https://api.open-meteo.com/v1/forecast?' + q);
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        cache[c.id] = {
          at: Date.now(), temp: d.current.temperature_2m, code: d.current.weather_code, day: d.current.is_day === 1,
          hi: d.daily.temperature_2m_max[0], lo: d.daily.temperature_2m_min[0],
          sunrise: d.daily.sunrise[0].slice(11, 16), sunset: d.daily.sunset[0].slice(11, 16)
        };
      } catch {}
    }));
    local.set('softtab.weather', cache);
    renderWeather();
  }
  function tickQuiet(now) {
    cities.forEach(c => {
      const el = cityEl(c.id); if (!el) return;
      const p = partsIn(c.tz, now), off = offsetMinutes(c.tz, now);
      $('[data-hm]', el).textContent = `${p.hour}:${p.minute}`;
      $('[data-date]', el).textContent = `${p.weekday} ${p.day} ${p.month}`;
      const a = Math.abs(off);
      $('[data-utc]', el).textContent = `UTC${off >= 0 ? '+' : '−'}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`;
      $('[data-now]', el).style.left = ((Number(p.hour) * 60 + Number(p.minute)) / 1440 * 100) + '%';
    });
  }
  renderCities();

  /* ---------- Subway ---------- */
  const FEED_BASE = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2F';
  const ALERTS_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json';
  const ROUTE_FEEDS = {
    A: 'gtfs-ace', C: 'gtfs-ace', E: 'gtfs-ace', H: 'gtfs-ace', B: 'gtfs-bdfm', D: 'gtfs-bdfm', F: 'gtfs-bdfm', M: 'gtfs-bdfm',
    G: 'gtfs-g', J: 'gtfs-jz', Z: 'gtfs-jz', N: 'gtfs-nqrw', Q: 'gtfs-nqrw', R: 'gtfs-nqrw', W: 'gtfs-nqrw', L: 'gtfs-l', SIR: 'gtfs-si'
  };
  const feedsFor = routes => [...new Set(routes.flatMap(r => r === 'S' ? ['gtfs', 'gtfs-bdfm', 'gtfs-ace'] : [ROUTE_FEEDS[r] || 'gtfs']))];
  const STATIONS = new Map(SUBWAY_STATIONS.map(([id, name, routes, boro, north, south]) =>
    [id, { id, name: name.replace(/-/g, '–'), routes: routes.split(' '), boro, north, south }]));
  const stationName = id => STATIONS.get(id)?.name || id;
  const routesAt = id => STATIONS.get(id)?.routes || [];
  const sharedRoutes = (a, b) => b ? routesAt(a).filter(r => routesAt(b).includes(r)) : routesAt(a);
  const dirLabel = (id, dir) => STATIONS.get(id)?.[dir === 'N' ? 'north' : 'south'] || (dir === 'N' ? 'Northbound' : 'Southbound');
  const LINE_COLORS = {
    ACE: '#0039a6', BDFM: '#ff6319', G: '#6cbe45', JZ: '#996633', L: '#a7a9ac',
    NQRW: '#fccc0a', 123: '#ee352e', 456: '#00933c', 7: '#b933ad', S: '#808183'
  };
  const bulletStyle = r => {
    const key = r === 'SIR' ? 'ACE' : Object.keys(LINE_COLORS).find(k => k.includes(r[0])) || 'S';
    return `background:${LINE_COLORS[key]};color:${key === 'NQRW' ? '#1c1f1d' : '#fff'}`;
  };
  const bullet = (r, size) => `<span class="bullet ${size}" style="${bulletStyle(r)}" aria-label="${esc(r)} train">${esc(r)}</span>`;

  // A trip is a named ride between two stations; only trains stopping at both count.
  const TRIP_DEFAULTS = LOCAL_DEFAULTS.trips || [
    { id: 'downtown', name: 'Downtown', from: 'R16', to: 'R20', walk: 5, dir: 'S' }
  ];
  // Stop ids on one line count up southbound (A02 Inwood … A55 Euclid Av), which gives a trip its direction.
  function guessDir(from, to) {
    const a = /^([A-Z]*)(\d+)$/.exec(from), b = /^([A-Z]*)(\d+)$/.exec(to);
    if (!a || !b || a[1] !== b[1] || (a[1] === '' && from[0] !== to[0])) return '';
    return Number(b[2]) > Number(a[2]) ? 'S' : 'N';
  }
  let trips = (local.get('softtab.trips', null) || structuredClone(TRIP_DEFAULTS)).map(t => ({ ...t, dir: t.dir || guessDir(t.from, t.to) }));
  const saveTrips = () => { local.set('softtab.trips', trips); synced.set('trips', trips); };
  let trip = trips[0]?.id;
  const curTrip = () => trips.find(t => t.id === trip) || trips[0];

  const subway = local.get('softtab.subway2', { deps: {}, updated: {} });
  let subwayError = false;

  // Direct trains stop at both stations. Trains on the usual lines heading the same way but not
  // reaching the destination (reroutes, short turns) are kept and flagged, so a diversion doesn't look like no service.
  function extractDeps(feedTrips, t) {
    const direct = [], other = [], usual = sharedRoutes(t.from, t.to);
    feedTrips.forEach(tr => {
      const stops = tr.stops;
      const i = stops.findIndex(s => s.id.slice(0, -1) === t.from);
      if (i < 0 || !stops[i].t) return;
      const dep = { r: tr.route || '?', at: stops[i].t * 1000, dest: stationName(stops[stops.length - 1].id.slice(0, -1)), dir: stops[i].id.slice(-1) };
      if (!t.to) { if (dep.dir === t.dir) direct.push(dep); return; }  // no destination: every train heading that way
      (stops.slice(i + 1).some(s => s.id.slice(0, -1) === t.to) ? direct : other).push(dep);
    });
    if (!t.to) return direct.sort((a, b) => a.at - b.at);
    const dir = t.dir || direct[0]?.dir || '';
    const skips = dir ? other.filter(d => d.dir === dir && usual.includes(d.r)).map(d => ({ ...d, skip: true })) : [];
    return [...direct, ...skips].sort((a, b) => a.at - b.at);
  }
  let subwayLoading = false;
  async function refreshSubway() {
    const t = curTrip();
    if (!t || subwayLoading) return;
    subwayLoading = true;
    try {
      const feeds = feedsFor([...new Set([...routesAt(t.from), ...routesAt(t.to)])]);
      const all = (await Promise.all(feeds.map(async f => {
        const r = await fetch(FEED_BASE + f, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        return decodeTrips(await r.arrayBuffer());
      }))).flat();
      subway.deps[t.id] = extractDeps(all, t);
      subway.updated[t.id] = Date.now();
      subwayError = false;
      local.set('softtab.subway2', subway);
    } catch { subwayError = true; }
    subwayLoading = false;
    renderSubway(Date.now());
  }

  let alertsRaw = [], alertsUpdated = 0;
  async function refreshAlerts() {
    try {
      const r = await fetch(ALERTS_URL, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      alertsRaw = (await r.json()).entity || [];
      alertsUpdated = Date.now();
    } catch { alertsRaw = null; }
    renderAlerts();
  }
  function renderAlerts() {
    const chip = $('#status'), list = $('#alerts'), t = curTrip();
    if (!alertsRaw || !t) { chip.hidden = true; list.hidden = true; return; }
    const lines = sharedRoutes(t.from, t.to), now = Date.now() / 1000, seen = new Set(), items = [];
    let delays = false;
    alertsRaw.forEach(e => {
      const a = e.alert; if (!a) return;
      if (!(a.informed_entity || []).some(i => lines.includes(i.route_id))) return;
      if (!(a.active_period || []).some(p => (p.start || 0) <= now && now <= (p.end || Infinity))) return;
      const text = (a.header_text?.translation || []).find(x => x.language === 'en')?.text?.trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      if (/delay/i.test(a['transit_realtime.mercury_alert']?.alert_type || '')) delays = true;
      items.push(text);
    });
    const level = delays ? 'delays' : items.length ? 'change' : 'good';
    chip.hidden = !alertsUpdated;
    chip.dataset.level = level;
    $('span', chip).textContent = { good: 'Good service', change: 'Service change', delays: 'Delays' }[level];
    chip.disabled = !items.length;
    list.innerHTML = items.slice(0, 5).map(x => `<li>${esc(x).replace(/\[([A-Z0-9]{1,3})\]/g, (_, r) => bullet(r, 'xs'))}</li>`).join('');
    if (!items.length) { list.hidden = true; chip.setAttribute('aria-expanded', 'false'); }
  }
  $('#status').addEventListener('click', () => {
    const list = $('#alerts'), open = list.hidden;
    list.hidden = !open;
    $('#status').setAttribute('aria-expanded', String(open));
  });

  function renderTripBar() {
    $('#trip-seg').innerHTML = trips.map(t =>
      `<button data-trip="${esc(t.id)}" aria-pressed="${t.id === trip}">${esc(t.name)}</button>`).join('');
  }
  function setTrip(id) {
    trip = id;
    const t = curTrip();
    if (!t) return;
    $$('[data-trip]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.trip === t.id)));
    $('#stop-name').textContent = stationName(t.from);
    $('#stop-dir').textContent = `toward ${t.to ? stationName(t.to) : dirLabel(t.from, t.dir)} · ${t.walk} min walk`;
    const first = sharedRoutes(t.from, t.to)[0] || routesAt(t.from)[0] || '';
    const hb = $('.hero .bullet');
    hb.textContent = first; hb.setAttribute('style', bulletStyle(first));
    renderAlerts();
    renderSubway(Date.now());
    if (mode === 'subway' && Date.now() - (subway.updated[t.id] || 0) > 20000) refreshSubway();
  }
  $('#trip-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-trip]'); if (!b) return;
    setTrip(b.dataset.trip);
    if (!tripForm.hidden) openTripForm(b.dataset.trip);
  });

  function renderSubway(now) {
    const t = curTrip();
    if (!t) return;
    const deps = (subway.deps[t.id] || []).filter(d => d.at > now - 20000).slice(0, 6);
    const catchable = d => (d.at - now) / 60000 >= t.walk;
    const nextDep = deps.find(d => catchable(d) && !d.skip) || deps.find(catchable);
    let next = null;
    $('#deps').innerHTML = deps.map(d => {
      const secs = (d.at - now) / 1000, mins = Math.max(0, Math.floor(secs / 60)), leave = Math.floor(secs / 60 - t.walk);
      let cls = d.skip ? 'skip' : '', hint = '';
      if (secs / 60 < t.walk) cls += ' missed';
      else {
        hint = leave < 1 ? 'Leave now' : `Leave in ${leave} min`;
        if (d === nextDep) { next = { ...d, secs, leave }; cls += ' next'; }
      }
      if (d.skip) hint = `Skips ${stationName(t.to)}` + (hint ? ` · ${hint.toLowerCase()}` : '');
      const when = secs < 45 ? 'Now' : `${mins}<small>min</small>`;
      return `<li class="dep ${cls}">${bullet(d.r, 'sm')}
        <span class="dest">${esc(d.dest)}${hint ? `<span class="when-sub">${hint}</span>` : ''}</span>
        <span class="mins">${when}<span class="arr">${nyClock.format(d.at)}</span></span></li>`;
    }).join('') || `<li class="empty">${subwayError ? 'MTA feed unavailable' : subway.updated[t.id] ? 'No trains in the feed' : 'Loading…'}</li>`;

    const hb = $('.hero .bullet');
    if (next) {
      $('#leave-big').textContent = next.leave < 1 ? 'Leave now' : `Leave in ${next.leave} min`;
      $('#leave-sub').textContent = `${nyClock.format(next.at)} ${next.r} to ${next.dest}` + (next.skip ? ` · skips ${stationName(t.to)}` : '');
      hb.textContent = next.r;
      hb.setAttribute('style', bulletStyle(next.r));
    } else {
      $('#leave-big').textContent = '–';
      $('#leave-sub').textContent = '';
    }
    const upd = subway.updated[t.id];
    $('#updated').textContent = subwayError ? 'Offline' : upd ? nyClock.format(upd) : '';
  }

  // Trip editor
  const tripForm = $('#trip-form');
  let editingTrip = null, formWalk = 10, formDir = '';
  const normStation = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function setStationField(which, id) {
    const input = $(`#trip-${which}`);
    input.dataset.id = id || '';
    input.value = id ? stationName(id) : '';
    $(`#trip-${which}-results`).innerHTML = '';
    renderDirPick();
  }
  // Without a destination the trip needs a direction, labelled the way the MTA signs that platform.
  function renderDirPick() {
    const from = $('#trip-from').dataset.id, to = $('#trip-to').dataset.id;
    const row = $('#trip-dir-row');
    row.hidden = !from || !!to;
    if (row.hidden) return;
    const opts = ['N', 'S'].filter(d => STATIONS.get(from)?.[d === 'N' ? 'north' : 'south']);
    if (!opts.includes(formDir)) formDir = opts[0] || 'N';
    $('#trip-dir').innerHTML = opts.map(d =>
      `<button type="button" data-dir="${d}" aria-pressed="${d === formDir}">${esc(dirLabel(from, d))}</button>`).join('');
  }
  $('#trip-dir').addEventListener('click', e => {
    const b = e.target.closest('[data-dir]'); if (!b) return;
    formDir = b.dataset.dir; renderDirPick();
  });
  function setWalk(n) { formWalk = Math.max(0, Math.min(60, n)); $('#trip-walk').textContent = `${formWalk} min`; }
  $('#trip-walk-minus').addEventListener('click', () => setWalk(formWalk - 1));
  $('#trip-walk-plus').addEventListener('click', () => setWalk(formWalk + 1));
  $('#trip-swap').addEventListener('click', () => {
    const a = $('#trip-from').dataset.id, b = $('#trip-to').dataset.id;
    if (!b) return;
    setStationField('from', b); setStationField('to', a);
  });
  function stationMatches(q, which) {
    const terms = normStation(q).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const fromId = $('#trip-from').dataset.id, out = [];
    for (const s of STATIONS.values()) {
      const hay = normStation(s.name) + ' ' + s.routes.join(' ').toLowerCase();
      if (!terms.every(t => hay.includes(t))) continue;
      if (which === 'to' && fromId && (s.id === fromId || !sharedRoutes(fromId, s.id).length)) continue;
      out.push(s);
      if (out.length >= 6) break;
    }
    return out;
  }
  function renderStationResults(which) {
    const input = $(`#trip-${which}`), list = $(`#trip-${which}-results`);
    const hits = input.dataset.id ? [] : stationMatches(input.value, which);
    list.innerHTML = hits.map((s, i) => `
      <li><button type="button" class="city-hit${i === 0 ? ' active' : ''}" data-station="${s.id}">
        <span>${esc(s.name)}</span><span class="where">${s.routes.map(r => bullet(r, 'xs')).join('')}</span>
      </button></li>`).join('');
  }
  ['from', 'to'].forEach(which => {
    const input = $(`#trip-${which}`), list = $(`#trip-${which}-results`);
    input.addEventListener('input', () => { input.dataset.id = ''; renderStationResults(which); renderDirPick(); });
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const first = $('[data-station]', list);
      if (first) { e.preventDefault(); first.click(); }
    });
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-station]'); if (!b) return;
      setStationField(which, b.dataset.station);
      if (which === 'from') {
        const to = $('#trip-to').dataset.id;
        if (to && !sharedRoutes(b.dataset.station, to).length) setStationField('to', '');
        $('#trip-to').focus();
      }
    });
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.station-pick')) $$('.station-pick .city-results').forEach(l => { l.innerHTML = ''; });
  });
  function openTripForm(id) {
    editingTrip = id;
    const t = id === 'new' ? { name: '', from: '', to: '', walk: 10, dir: '' } : trips.find(x => x.id === id);
    $('#trip-form-title').textContent = id === 'new' ? 'New trip' : 'Edit trip';
    $('#trip-name').value = t.name;
    formDir = t.dir || '';
    setStationField('from', t.from);
    setStationField('to', t.to);
    setWalk(t.walk);
    $('#trip-delete').hidden = id === 'new' || trips.length < 2;
    resetDelete();
    $('#trip-err').hidden = true;
    tripForm.hidden = false;
    $('.subway-grid').hidden = true;
    $('#trip-name').focus();
  }
  function closeTripForm() { tripForm.hidden = true; $('.subway-grid').hidden = false; editingTrip = null; }
  $('#trip-add').addEventListener('click', () => openTripForm('new'));
  $('#trip-edit').addEventListener('click', () => { if (curTrip()) openTripForm(curTrip().id); });
  $('#trip-cancel').addEventListener('click', closeTripForm);
  tripForm.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeTripForm(); } });
  let deleteTimer = 0;
  function resetDelete() {
    clearTimeout(deleteTimer);
    $('#trip-delete').classList.remove('confirm');
    $('#trip-delete span').textContent = 'Delete';
  }
  $('#trip-delete').addEventListener('click', () => {
    const btn = $('#trip-delete');
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      $('span', btn).textContent = 'Confirm';
      deleteTimer = setTimeout(resetDelete, 3000);
      return;
    }
    resetDelete();
    trips = trips.filter(t => t.id !== editingTrip);
    delete subway.deps[editingTrip];
    saveTrips(); closeTripForm(); renderTripBar(); setTrip(trips[0].id);
  });
  tripForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#trip-name').value.trim(), from = $('#trip-from').dataset.id, to = $('#trip-to').dataset.id || '';
    const err = m => { $('#trip-err').textContent = m; $('#trip-err').hidden = false; };
    if (!name) return err('Add a name');
    if (!from) return err('Pick a station from the list');
    if ($('#trip-to').value.trim() && !to) return err('Pick the destination from the list, or clear it');
    if (to && !sharedRoutes(from, to).length) return err('No direct train between these stations');
    const dir = to ? guessDir(from, to) : formDir;
    const walk = formWalk;
    let id = editingTrip;
    if (id === 'new') { id = 't' + Date.now().toString(36); trips.push({ id, name, from, to, walk, dir }); }
    else Object.assign(trips.find(x => x.id === id), { name, from, to, walk, dir });
    delete subway.deps[id]; delete subway.updated[id];
    saveTrips(); closeTripForm(); renderTripBar(); setTrip(id);
    refreshSubway();
  });
  synced.get('trips').then(v => {
    if (v && v.length && JSON.stringify(v) !== JSON.stringify(trips)) {
      trips = v; local.set('softtab.trips', v);
      if (!curTrip() || !trips.some(t => t.id === trip)) trip = trips[0].id;
      renderTripBar(); setTrip(trip);
    }
  });

  /* ---------- Work links ---------- */
  function normalizeUrl(v) {
    let url = v.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { return new URL(url).hostname.includes('.') ? url : null; } catch { return null; }
  }

  const WORK_DEFAULTS = LOCAL_DEFAULTS.work || [
    { g: 'Code', items: [
      { n: 'GitHub', u: 'https://github.com' }
    ]},
    { g: 'Plan', items: [
      { n: 'Linear', u: 'https://linear.app' },
      { n: 'Calendar', u: 'https://calendar.google.com' }
    ]},
    { g: 'Talk', items: [
      { n: 'Mail', u: 'https://mail.google.com' },
      { n: 'Meet', u: 'https://meet.google.com' }
    ]}
  ];
  // Tabs the user has hidden (built-in or boards), managed from settings.
  let hiddenTabs = local.get('softtab.hiddenTabs', []);
  const saveHidden = () => { local.set('softtab.hiddenTabs', hiddenTabs); synced.set('hiddenTabs', hiddenTabs); };

  // Link boards: tabs of quick links grouped by category. Work is the first one; more can be added.
  const BOARD_ICONS = {
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
    home: '<path d="M4 11l8-6.5 8 6.5M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5M10 20v-5h4v5"/>',
    code: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    folder: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.5l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    cart: '<path d="M4 5h2l2 10h10l2-7H7.5"/><circle cx="9.5" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2"/>',
    plane: '<path d="M20.5 3.5L3.5 10.5l7 2.5 2.5 7zM10.5 13l4.5-4.5"/>',
    coffee: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12 3.5v2.5"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-1.9-.5-1.2.3-2.1 1.5-2.1H17a3.5 3.5 0 0 0 3.5-3.5c0-5.3-3.8-9.5-8.5-9.5z"/><circle cx="8" cy="10.5" r=".9" fill="currentColor"/><circle cx="12" cy="7.5" r=".9" fill="currentColor"/><circle cx="16" cy="10.5" r=".9" fill="currentColor"/>',
    camera: '<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13" r="3.5"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    game: '<path d="M7 8h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L14 14.5h-4l-.7 1.1A3.5 3.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4zM7.5 11v3M6 12.5h3M15.5 12h.01M17.5 13.5h.01"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'
  };
  const boardIcon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${BOARD_ICONS[k] || BOARD_ICONS.star}</svg>`;

  // Older saves keep working: renamed Work links and bundled icons are carried over by address.
  const defaultIcons = new Map(WORK_DEFAULTS.flatMap(g => g.items).filter(it => it.icon).map(it => [it.u, it.icon]));
  const RENAMED_LINKS = LOCAL_DEFAULTS.renamedLinks || {};
  const fixLinks = groups => groups.map(g => ({ ...g, items: g.items.map(it => ({
    ...it, n: RENAMED_LINKS[it.n] || it.n,
    ...(it.icon || !defaultIcons.has(it.u) ? {} : { icon: defaultIcons.get(it.u) })
  })) }));
  const workBoard = groups => ({ id: 'work', name: 'Work', icon: 'briefcase', groups: fixLinks(groups) });
  let boards = local.get('softtab.boards', null)
    || [workBoard(local.get('softtab.links.work-v2', null) || structuredClone(WORK_DEFAULTS))];
  const saveBoards = () => { local.set('softtab.boards', boards); synced.set('boards', boards); };
  let boardId = boards[0]?.id || null, catEditing = null, boardForm = null;
  const curBoard = () => boards.find(b => b.id === boardId);
  const boardEl = $('#work');

  function renderSwitcherBoards() {
    $$('.mode-btn[data-board-btn]').forEach(b => b.remove());
    $$('.mode-btn').forEach(b => { b.hidden = hiddenTabs.includes(b.dataset.mode); });
    const nav = $('.switcher');
    boards.forEach(b => {
      nav.insertAdjacentHTML('beforeend', `
        <button class="mode-btn" role="tab" data-mode="board:${esc(b.id)}" data-board-btn ${hiddenTabs.includes('board:' + b.id) ? 'hidden' : ''} aria-selected="${mode === 'board:' + b.id}" title="${esc(b.name)}">
          ${boardIcon(b.icon)}<span class="label">${esc(b.name)}</span>
        </button>`);
    });
  }

  const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const linkTile = (it, gi, i, g) => `
    <div class="tile-wrap">
      <a class="tile" href="${esc(it.u)}">
        <span class="icon">${iconFor(it.u, it.n, it.icon)}</span><span class="n">${esc(it.n)}</span>
      </a>
      <button class="rm" data-rm="${gi}:${i}" aria-label="Remove ${esc(it.n)}">${xSvg}</button>
    </div>`;
  const linkForm = gi => boardForm !== gi ? '' : `
    <form class="add-form" data-form="${gi}" novalidate>
      <input class="field" id="board-add-name-${gi}" placeholder="Name" aria-label="Name">
      <input class="field" id="board-add-url-${gi}" placeholder="Link" aria-label="Link">
      <button class="pill-btn" type="submit">Add</button>
      <button class="pill-btn subtle" type="button" data-cancel>Cancel</button>
      <span class="err" hidden></span>
    </form>`;

  // Each category edits on its own: hover shows Edit after its links; editing adds ×, an Add tile and rename/remove.
  function renderBoard() {
    const b = curBoard();
    if (!b) { boardEl.innerHTML = '<p class="empty">No tab here</p>'; return; }
    $('#board-section').setAttribute('aria-label', b.name);
    boardEl.innerHTML = `<div class="groups">${b.groups.map((g, gi) => {
      const editing = catEditing === gi;
      return `
      <div class="group${editing ? ' editing' : ''}${g.items.length ? '' : ' empty-cat'}">
        ${editing
          ? `<div class="cat-edit"><input class="cat-name" data-cat="${gi}" value="${esc(g.g)}" aria-label="Category name"><button class="x" data-rm-cat="${gi}" aria-label="Remove ${esc(g.g)}" title="Remove category">${xSvg}<span class="lbl">Remove</span></button></div>`
          : `<h2 class="eyebrow">${esc(g.g)}</h2>`}
        <div>
          <div class="tiles">${g.items.map((it, i) => linkTile(it, gi, i, g)).join('')}
            ${editing || !g.items.length ? `<button class="tile add-btn" data-add="${gi}" aria-label="Add a link to ${esc(g.g)}"><span class="icon">+</span><span class="n">Add</span></button>` : ''}
            <button class="pill-btn cat-btn${editing ? ' on' : ''}" data-edit-cat="${gi}" aria-label="${editing ? 'Done editing' : 'Edit'} ${esc(g.g)}">${editing ? CHECK + 'Done' : PENCIL + 'Edit'}</button>
          </div>${linkForm(gi)}
        </div>
      </div>`;
    }).join('')}</div>
      <button class="pill-btn add-cat" data-add-cat>${PLUS}Add a category</button>`;
    fixFavicons(boardEl);
  }
  function editCategory(gi) {
    catEditing = gi; boardForm = null;
    renderBoard();
  }

  boardEl.addEventListener('click', e => {
    const b = curBoard(); if (!b) return;
    const edit = e.target.closest('[data-edit-cat]');
    if (edit) { const gi = Number(edit.dataset.editCat); editCategory(catEditing === gi ? null : gi); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) { const [gi, i] = rm.dataset.rm.split(':').map(Number); b.groups[gi].items.splice(i, 1); saveBoards(); renderBoard(); return; }
    const rmCat = e.target.closest('[data-rm-cat]');
    if (rmCat) {
      const gi = Number(rmCat.dataset.rmCat);
      // A category with links asks twice.
      if (b.groups[gi].items.length && !rmCat.classList.contains('confirm')) {
        rmCat.dataset.label = rmCat.getAttribute('aria-label');
        rmCat.classList.add('confirm'); rmCat.setAttribute('aria-label', 'Confirm: remove the category and its links');
        return;
      }
      b.groups.splice(gi, 1); catEditing = null; saveBoards(); renderBoard(); return;
    }
    if (e.target.closest('[data-add-cat]')) {
      b.groups.push({ g: 'New category', items: [] }); saveBoards();
      editCategory(b.groups.length - 1);
      const input = $(`.cat-name[data-cat="${b.groups.length - 1}"]`); input?.focus(); input?.select();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) { boardForm = Number(add.dataset.add); renderBoard(); $(`#board-add-name-${boardForm}`).focus(); return; }
    if (e.target.closest('[data-cancel]')) { boardForm = null; renderBoard(); return; }
    if (e.target.closest('.group.editing a')) e.preventDefault();
  });
  boardEl.addEventListener('change', e => {
    const input = e.target.closest('.cat-name'); if (!input) return;
    const b = curBoard(), gi = Number(input.dataset.cat);
    b.groups[gi].g = input.value.trim() || b.groups[gi].g;
    saveBoards();
  });
  boardEl.addEventListener('keydown', e => {
    if (e.target.closest('.cat-name') && e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape' && catEditing !== null) { e.stopPropagation(); e.target.blur?.(); editCategory(null); }
  });
  boardEl.addEventListener('submit', e => {
    e.preventDefault();
    const b = curBoard(), gi = Number(e.target.dataset.form), err = $('.err', e.target);
    const name = $(`#board-add-name-${gi}`).value.trim();
    const url = normalizeUrl($(`#board-add-url-${gi}`).value);
    if (!name || !url) { err.textContent = name ? 'That address doesn’t look right' : 'Add a name'; err.hidden = false; return; }
    b.groups[gi].items.push({ n: name, u: url });
    saveBoards(); boardForm = null; renderBoard();
  });

  function newBoard() {
    const b = { id: 'b' + Date.now().toString(36), name: 'New tab', icon: 'star', groups: [{ g: 'Links', items: [] }] };
    boards.push(b); saveBoards(); renderSwitcherBoards(); renderTabList();
    setMode('board:' + b.id);
    // Name it right away, where tabs are managed.
    togglePop(true);
    const input = $(`.tab-name[data-rename="board:${b.id}"]`);
    input?.focus(); input?.select();
  }

  synced.get('boards').then(v => {
    if (v && v.length && JSON.stringify(v) !== JSON.stringify(boards)) {
      boards = v; local.set('softtab.boards', v);
      renderSwitcherBoards(); renderTabList();
      if (mode?.startsWith('board:') && !curBoard()) setMode(boards[0] ? 'board:' + boards[0].id : 'weather');
      else renderBoard();
    } else if (!v) {
      // First run after the update: carry Work links saved on another machine.
      synced.get('links.work-v2').then(w => {
        if (w && !local.get('softtab.boards', null)) { boards = [workBoard(w)]; saveBoards(); renderSwitcherBoards(); renderBoard(); }
      });
    }
  });


  /* ---------- Inspiration: sources ---------- */
  const LINK_DEFAULTS = [
    { g: 'Radio', items: [
      { n: 'FIP', u: 'https://www.radiofrance.fr/fip' },
      { n: 'NTS', u: 'https://www.nts.live' },
      { n: 'ROVR', u: 'https://rovr.live' },
      { n: 'dublab', u: 'https://www.dublab.com' }
    ]},
    { g: 'Sets', items: [
      { n: 'Boiler Room', u: 'https://boilerroom.tv' },
      { n: 'Cercle', u: 'https://www.youtube.com/@Cercle' }
    ]}
  ];
  let linkGroups = local.get('softtab.links.listen', null) || structuredClone(LINK_DEFAULTS);
  const saveLinks = () => { local.set('softtab.links.listen', linkGroups); synced.set('links.listen', linkGroups); };
  let ytChannels = local.get('softtab.yt.channels', []);              // [{ path, name }]
  const saveChannels = () => { local.set('softtab.yt.channels', ytChannels); synced.set('yt.channels', ytChannels); };
  let ytIndex = local.get('softtab.yt.index', { at: 0, items: {} });  // path -> [{ id, title, age }]
  let rdIndex = local.get('softtab.rd.index', { at: 0, cols: [], items: [] });
  let rdToken = '';
  let pins = local.get('softtab.pins', []);  // [{ u, t, m, c, tags }], a snapshot so a pin survives its source
  const savePins = () => { local.set('softtab.pins', pins); synced.set('pins', pins); };

  // YouTube: reads a channel's Videos page (YouTube's RSS feeds currently 404).
  function parseChannel(input) {
    const v = input.trim();
    let m = v.match(/channel\/(UC[\w-]{22})/) || v.match(/^(UC[\w-]{22})$/);
    if (m) return '/channel/' + m[1];
    m = v.match(/@([\w.-]+)/);
    return m ? '/@' + m[1] : null;
  }
  function findVideos(root, max = 12) {
    const out = [], stack = [root];
    while (stack.length && out.length < max) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      const l = o.lockupViewModel;
      if (l && l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
        const md = l.metadata?.lockupMetadataViewModel;
        const parts = (md?.metadata?.contentMetadataViewModel?.metadataRows || []).flatMap(r => r.metadataParts || []).map(p => p.text?.content || '');
        if (l.contentId && md?.title?.content) out.push({ id: l.contentId, title: md.title.content, age: parts.find(t => /ago$/.test(t)) || '' });
        continue;
      }
      const v = o.videoRenderer;
      if (v) {
        if (v.videoId) out.push({ id: v.videoId, title: v.title?.runs?.[0]?.text || '', age: v.publishedTimeText?.simpleText || '' });
        continue;
      }
      const vals = Array.isArray(o) ? o : Object.values(o);
      for (let i = vals.length - 1; i >= 0; i--) stack.push(vals[i]);
    }
    return out;
  }
  async function fetchChannel(path) {
    const r = await fetch('https://www.youtube.com' + path + '/videos', { credentials: 'include' });
    if (!r.ok) throw new Error(String(r.status));
    const html = await r.text();
    const m = html.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
    if (!m) throw new Error('parse');
    const data = JSON.parse(m[1]);
    return { name: data.metadata?.channelMetadataRenderer?.title || path.replace(/^\/@?/, ''), videos: findVideos(data) };
  }
  async function refreshYouTube(force = false) {
    if (!ytChannels.length || (!force && Date.now() - ytIndex.at < 30 * 60e3)) return;
    await Promise.all(ytChannels.map(async ch => {
      try { ytIndex.items[ch.path] = (await fetchChannel(ch.path)).videos; } catch {}
    }));
    ytIndex.at = Date.now();
    local.set('softtab.yt.index', ytIndex);
    buildIndex();
  }

  // Raindrop (token lives in Settings)
  async function rd(path) {
    const r = await fetch('https://api.raindrop.io/rest/v1' + path, { headers: { Authorization: 'Bearer ' + rdToken } });
    if (r.status === 401) throw new Error('auth');
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  function showRdMsg(text, kind) {
    const m = $('#raindrop-msg');
    m.textContent = text; m.classList.toggle('err', kind === true); m.classList.toggle('warn', kind === 'warn'); m.hidden = !text;
  }
  const mapRaindrop = i => ({
    id: i._id, t: i.title || i.link, u: i.link, col: i.collection?.$id ?? -1,
    tags: i.tags || [], ex: (i.excerpt || '').slice(0, 200)
  });
  // Only the 50 newest bookmarks are cached. Queries, tags and collections are searched
  // across the whole library by Raindrop, and the results merge into the index as they arrive.
  let remote = { key: '', items: [] }, remotePending = '', remoteTimer = 0, remoteSeq = 0;
  const rdTags = {};  // collection id -> { at, list: [[tag, count]] }
  const rdColId = cat => cat === 'All' ? 0 : cat === 'Unsorted' ? -1 : (rdIndex.cols.find(c => c.title === cat)?.id ?? null);
  function scheduleRemote(q) {
    const tag = activeCat.startsWith('#') ? activeCat.slice(1) : '';
    const col = tag ? 0 : rdColId(activeCat);
    const search = [q, tag ? (tag.includes(' ') ? `#"${tag}"` : '#' + tag) : ''].filter(Boolean).join(' ');
    const key = scope === 'raindrop' && rdToken && col !== null && (search || col !== 0) ? `${col}|${search}` : '';
    if (key === remote.key || (key && key === remotePending)) return;
    clearTimeout(remoteTimer);
    const seq = ++remoteSeq;
    remotePending = key;
    if (!key) { const had = remote.items.length; remote = { key: '', items: [] }; if (had) buildIndex(); return; }
    remoteTimer = setTimeout(async () => {
      try {
        const res = await rd(`/raindrops/${col}?perpage=50&sort=-created${search ? '&search=' + encodeURIComponent(search) : ''}`);
        if (seq !== remoteSeq) return;
        remote = { key, items: res.items.map(mapRaindrop) };
        remotePending = '';
        buildIndex();
      } catch { if (seq === remoteSeq) remotePending = ''; }
    }, search ? 250 : 0);
  }
  async function loadTags(col) {
    const c = rdTags[col];
    if (c && (c.loading || Date.now() - c.at < 10 * 60e3)) return;
    rdTags[col] = { at: 0, list: c?.list || [], loading: true };
    try { const res = await rd(`/tags/${col}`); rdTags[col] = { at: Date.now(), list: res.items.map(t => [t._id, t.count]) }; }
    catch { rdTags[col] = { at: Date.now(), list: c?.list || [] }; }
    runSearch();
  }
  async function refreshRaindrop(force = false) {
    if (!rdToken || (!force && Date.now() - rdIndex.at < 10 * 60e3)) return;
    try {
      const [roots, kids] = await Promise.all([rd('/collections'), rd('/collections/childrens')]);
      const cols = [...roots.items, ...kids.items].map(c => ({ id: c._id, title: c.title, count: c.count || 0 }));
      const res = await rd('/raindrops/0?perpage=50&sort=-created');
      rdIndex = { at: Date.now(), cols, items: res.items.map(mapRaindrop), total: res.count ?? res.items.length };
      local.set('softtab.rd.index', rdIndex);
      showRdMsg(`${rdIndex.total} bookmarks`, false);
    } catch (e) { showRdMsg(e.message === 'auth' ? 'Raindrop rejected this token' : 'Couldn’t reach Raindrop', true); }
    buildIndex();
  }
  // Without a token, the Raindrop tab gets a dot and an Add token button, and settings say so.
  function openRaindropSettings() {
    expandedTab = 'raindrop'; renderTabList(); togglePop(true);
    $('#raindrop-token').focus();
  }
  function syncRaindropState() {
    $('.mode-btn[data-mode="raindrop"]')?.classList.toggle('warn', !rdToken);
    renderTabList();
    if (!rdToken) showRdMsg('Not connected', 'warn');
    else if ($('#raindrop-msg').textContent === 'Not connected') showRdMsg('', false);
  }
  $('#raindrop-form').addEventListener('submit', async e => {
    e.preventDefault();
    rdToken = $('#raindrop-token').value.trim();
    await secret.set('raindropToken', rdToken);
    syncRaindropState();
    if (!rdToken) { rdIndex = { at: 0, cols: [], items: [] }; local.del('softtab.rd.index'); syncRaindropState(); buildIndex(); return; }
    showRdMsg('Checking…', false);
    await refreshRaindrop(true);
  });

  /* ---------- Inspiration: index + search ---------- */
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const MAX_HITS = 60;
  let index = [], byId = new Map(), cats = [], activeCat = 'All', results = [], activeIdx = -1;
  let scope = 'raindrop';  // which tab the finder is serving: 'raindrop' or 'music'
  const linkUrls = () => new Set(linkGroups.flatMap(g => g.items.map(it => it.u)));
  const pinScope = p => p.s || (linkUrls().has(p.u) ? 'music' : 'raindrop');  // activeCat '#tag' = a Raindrop tag
  let quick = null, quickState = '';
  const qInput = $('#insp-q'), hitsEl = $('#hits');

  function buildIndex() {
    const out = [];
    if (scope === 'music') {
      linkGroups.forEach((g, gi) => g.items.forEach((it, i) =>
        out.push({ id: `l:${gi}:${i}:${it.u}`, src: 'link', gi, i, title: it.n, url: it.u, cat: g.g, tags: [], meta: host(it.u) })));
      ytChannels.forEach(ch => (ytIndex.items[ch.path] || []).forEach(v =>
        out.push({ id: 'y:' + v.id, src: 'youtube', path: ch.path, channel: ch.name, title: v.title, url: 'https://www.youtube.com/watch?v=' + v.id, cat: 'Videos', tags: [ch.name], meta: ch.name + (v.age ? ' · ' + v.age : '') })));
    } else {
      const colName = new Map(rdIndex.cols.map(c => [c.id, c.title]));
      const remoteIds = new Set(remote.items.map(i => i.id));
      const addRd = (it, remoteKey) =>
        out.push({ id: 'r:' + it.id, src: 'raindrop', remote: remoteKey, title: it.t, url: it.u, cat: colName.get(it.col) || 'Unsorted', tags: it.tags, extra: it.ex, meta: host(it.u) });
      rdIndex.items.forEach(it => { if (!remoteIds.has(it.id)) addRd(it, ''); });
      remote.items.forEach(it => addRd(it, remote.key));
    }
    const scopedPins = pins.map((p, i) => ({ p, i })).filter(({ p }) => pinScope(p) === scope);
    const pinAt = new Map(scopedPins.map(({ p, i }) => [p.u, i])), pinnedSeen = new Set();
    out.forEach(it => { if (pinAt.has(it.url)) { it.pin = pinAt.get(it.url); pinnedSeen.add(it.url); } });
    scopedPins.forEach(({ p, i }) => {
      if (!pinnedSeen.has(p.u)) out.push({ id: 'p:' + p.u, src: 'pin', title: p.t, url: p.u, cat: p.c, tags: p.tags || [], meta: p.m, pin: i });
    });
    out.forEach((it, i) => {
      it.order = i;
      it.ntitle = norm(it.title);
      it.ntags = it.tags.map(norm);
      it.hay = norm([it.title, it.meta, it.cat, it.tags.join(' '), it.extra].join(' '));
    });
    index = out;
    byId = new Map(out.map(it => [it.id, it]));
    cats = [...new Set([
      ...(scope === 'music' ? linkGroups.map(g => g.g) : rdIndex.cols.filter(c => c.count).map(c => c.title)),
      ...out.map(i => i.cat).filter(c => c !== 'Unsorted')
    ])];
    if (activeCat !== 'All' && !activeCat.startsWith('#') && !cats.includes(activeCat)) activeCat = 'All';
    runSearch();
  }

  // Pasting a link or a YouTube @handle turns the top row into "Add …".
  // Extra words after a link become its name; the selected category pill is where it goes.
  function parseQuickAdd(raw) {
    const [first, ...rest] = raw.trim().split(/\s+/);
    if (!first) return null;
    if (scope === 'raindrop') {
      if (!rdToken || !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(first)) return null;
      const url = normalizeUrl(first);
      if (!url || rdIndex.items.some(it => it.u.replace(/\/$/, '') === url.replace(/\/$/, ''))) return null;
      return { kind: 'rd', url };
    }
    if (/^@[\w.-]+$/.test(first) || /youtube\.com\/(@|channel\/)/i.test(first)) {
      const path = parseChannel(first);
      if (!path || ytChannels.some(c => c.path.toLowerCase() === path.toLowerCase())) return null;
      return { kind: 'yt', path, label: first.match(/@[\w.-]+/)?.[0] || 'this channel' };
    }
    if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(first)) return null;
    const url = normalizeUrl(first);
    if (!url || linkGroups.some(g => g.items.some(it => host(it.u) + new URL(it.u).pathname === host(url) + new URL(url).pathname))) return null;
    const linkCats = linkGroups.map(g => g.g);
    const cat = activeCat !== 'All' && linkCats.includes(activeCat) ? activeCat : (linkCats[0] || 'Links');
    return { kind: 'link', url, name: rest.join(' ') || host(url), cat };
  }
  function quickHtml(active) {
    const q = quick;
    const label = quickState || (q.kind === 'yt' ? `Follow <b>${esc(q.label)}</b> on YouTube`
      : q.kind === 'rd' ? `Save <b>${esc(host(q.url))}</b> to Raindrop`
      : `Add <b>${esc(q.name)}</b> to ${esc(q.cat)}`);
    return `<button class="hit add-hit${active ? ' active' : ''}" data-quick ${quickState ? 'disabled' : ''}>
      <span class="ico plus">+</span><span class="ttl">${label}</span><span class="meta">${q.kind === 'yt' ? 'youtube.com' : esc(host(q.url))}</span></button>`;
  }
  async function doQuickAdd() {
    const q = quick; if (!q || quickState) return;
    if (q.kind === 'rd') {
      quickState = 'Saving…'; renderHits([]);
      try {
        const r = await fetch('https://api.raindrop.io/rest/v1/raindrop', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + rdToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: q.url, pleaseParse: {} })
        });
        if (!r.ok) throw new Error(String(r.status));
        const { item } = await r.json();
        rdIndex.items.unshift(mapRaindrop(item));
        rdIndex.total = (rdIndex.total ?? rdIndex.items.length) + 1;
        local.set('softtab.rd.index', rdIndex);
        quickState = ''; qInput.value = '';
        buildIndex();
      } catch {
        quickState = 'Couldn’t save to Raindrop'; renderHits([]);
        setTimeout(() => { quickState = ''; runSearch(); }, 2000);
      }
      return;
    }
    if (q.kind === 'link') {
      let g = linkGroups.find(x => x.g === q.cat);
      if (!g) linkGroups.push(g = { g: q.cat, items: [] });
      g.items.push({ n: q.name, u: q.url });
      saveLinks();
      qInput.value = '';
      buildIndex();
      return;
    }
    quickState = 'Looking up the channel…'; renderHits([]);
    try {
      const { name, videos } = await fetchChannel(q.path);
      ytChannels.push({ path: q.path, name });
      ytIndex.items[q.path] = videos;
      saveChannels(); local.set('softtab.yt.index', ytIndex);
      quickState = ''; qInput.value = ''; activeCat = 'Videos';
      buildIndex();
    } catch {
      quickState = 'Couldn’t find that channel'; renderHits([]);
      setTimeout(() => { quickState = ''; runSearch(); }, 2000);
    }
  }
  function removeItem(it) {
    if (it.src === 'link') {
      linkGroups[it.gi].items.splice(it.i, 1);
      linkGroups = linkGroups.filter(g => g.items.length);
      saveLinks();
    } else if (it.src === 'youtube') {
      ytChannels = ytChannels.filter(c => c.path !== it.path);
      delete ytIndex.items[it.path];
      saveChannels(); local.set('softtab.yt.index', ytIndex);
    }
    buildIndex();
  }

  function runSearch() {
    quick = quickState ? quick : parseQuickAdd(qInput.value);
    const terms = quick ? [] : norm(qInput.value.trim()).split(/\s+/).filter(Boolean);
    scheduleRemote(quick ? '' : qInput.value.trim());
    $('#insp-clear').hidden = !qInput.value;
    const matched = [];
    for (const it of index) {
      let score = 0, ok = true, tagHit = null;
      const trusted = it.remote && it.remote === remote.key;  // Raindrop already matched it (full text, excerpt…)
      for (const t of terms) {
        if (t[0] === '#' && t.length > 1) {
          const ti = it.ntags.findIndex(x => x.startsWith(t.slice(1)));
          if (ti < 0) { if (trusted) { score += .5; continue; } ok = false; break; }
          score += 2; tagHit = it.tags[ti]; continue;
        }
        if (!it.hay.includes(t)) { if (trusted) { score += .5; continue; } ok = false; break; }
        if (it.ntitle.startsWith(t) || it.ntitle.includes(' ' + t)) score += 3;
        else if (it.ntitle.includes(t)) score += 2;
        else {
          const ti = it.ntags.findIndex(x => x.includes(t));
          if (ti >= 0) { score += 1.5; tagHit = it.tags[ti]; } else score += 1;
        }
      }
      if (ok) matched.push({ it, score, tagHit });
    }
    const pinned = m => m.it.pin != null;
    if (terms.length) matched.sort((a, b) => (b.score + pinned(b)) - (a.score + pinned(a)) || a.it.order - b.it.order);
    else matched.sort((a, b) => (a.it.pin ?? 1e9) - (b.it.pin ?? 1e9) || a.it.order - b.it.order);
    const counts = {}, tagHits = new Map();
    matched.forEach(m => {
      counts[m.it.cat] = (counts[m.it.cat] || 0) + 1;
      if (m.it.src === 'raindrop') m.it.tags.forEach(t => tagHits.set(t, (tagHits.get(t) || 0) + 1));
    });
    const browsing = !terms.length && !quick && rdToken && scope === 'raindrop';
    const colCount = new Map(rdIndex.cols.map(c => [c.title, c.count]));
    const countFor = c => browsing && colCount.has(c) ? colCount.get(c) : (counts[c] || 0);
    const allCount = browsing ? matched.filter(m => m.it.src !== 'raindrop').length + (rdIndex.total ?? rdIndex.items.length) : matched.length;

    // Raindrop tags sit alongside the other categories: the most-used ones across the whole library.
    if (rdToken && scope === 'raindrop') loadTags(0);
    const libraryTags = new Map(scope === 'raindrop' && rdTags[0]?.list?.length ? rdTags[0].list : []);
    const tagSource = libraryTags.size ? libraryTags : tagHits;
    const activeTagName = activeCat.startsWith('#') ? activeCat.slice(1) : '';
    const topTags = [...tagSource].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([t]) => t);
    if (activeTagName && !topTags.includes(activeTagName)) topTags.push(activeTagName);
    const tagLabel = t => t === t.toLowerCase() ? t[0].toUpperCase() + t.slice(1) : t;
    const pills = [
      ['All', 'All', allCount],
      ...cats.map(c => [c, c, countFor(c)]),
      ...topTags.map(t => ['#' + t, tagLabel(t), browsing ? (libraryTags.get(t) ?? tagHits.get(t) ?? 0) : (tagHits.get(t) || 0)])
    ];
    $('#insp-filters').innerHTML = pills.map(([key, label, n]) =>
      `<button class="filter-pill${n ? '' : ' none'}" data-cat="${esc(key)}" aria-pressed="${key === activeCat}">${esc(label)}<span class="c">${n}</span></button>`).join('');
    results = activeCat === 'All' ? matched
      : activeTagName ? matched.filter(m => m.it.src === 'raindrop' && m.it.tags.includes(activeTagName))
      : matched.filter(m => m.it.cat === activeCat);
    activeIdx = (terms.length || quick) && (results.length || quick) ? 0 : -1;
    renderHits(terms);
  }

  function highlight(title, terms) {
    if (!terms.length) return esc(title);
    const n = norm(title);
    if (n.length !== title.length) return esc(title);
    const ranges = [];
    terms.forEach(t => { let i = n.indexOf(t); while (i >= 0) { ranges.push([i, i + t.length]); i = n.indexOf(t, i + t.length); } });
    if (!ranges.length) return esc(title);
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0]];
    ranges.slice(1).forEach(r => { const last = merged[merged.length - 1]; if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r); });
    let html = '', pos = 0;
    merged.forEach(([a, b]) => { html += esc(title.slice(pos, a)) + '<mark>' + esc(title.slice(a, b)) + '</mark>'; pos = b; });
    return html + esc(title.slice(pos));
  }
  const PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 3.5h5l-.8 5.3 3.3 3.2H7l3.3-3.2z"/><path d="M12 12v8.5"/></svg>';
  const PIN_MARK = '<svg class="pin-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.5 3.5h5l-.8 5.3 3.3 3.2H7l3.3-3.2z"/><path d="M12 12v8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function togglePin(it) {
    const i = pins.findIndex(p => p.u === it.url);
    if (i >= 0) pins.splice(i, 1);
    else pins.push({ u: it.url, t: it.title, m: it.meta, c: it.cat, tags: (it.tags || []).slice(0, 5), s: scope });
    savePins(); buildIndex();
  }
  function hitHtml(m, terms, active) {
    const it = m.it;
    let tags = it.src === 'raindrop' ? it.tags.slice(0, 3) : [];
    if (m.tagHit && it.src === 'raindrop' && !tags.includes(m.tagHit)) tags = [m.tagHit, ...tags.slice(0, 2)];
    const tag = tags.map(t => `<span class="tag${t === m.tagHit || '#' + t === activeCat ? ' on' : ''}">#${esc(t)}</span>`).join('');
    const rm = it.src === 'link' ? `Remove ${it.title}` : it.src === 'youtube' ? `Unfollow ${it.channel}` : '';
    const isPinned = it.pin != null, pinLabel = `${isPinned ? 'Unpin' : 'Pin'} ${it.title}`;
    const ico = it.src === 'youtube' ? iconFor('https://www.youtube.com/', '', null, '') : iconFor(it.url, it.title, null, '');
    return `<a class="hit${active ? ' active' : ''}" href="${esc(it.url)}">
      <span class="ico">${ico}</span>
      <span class="ttl">${highlight(it.title, terms)}${isPinned ? PIN_MARK : ''}${tag}</span>
      <span class="meta">${esc(it.meta)} ↗</span></a>
      <span class="hit-actions">
        <button class="hit-act pin" data-pin="${esc(it.id)}" aria-pressed="${isPinned}" aria-label="${esc(pinLabel)}" title="${isPinned ? 'Unpin' : 'Pin'}">${PIN_SVG}</button>
        ${rm ? `<button class="hit-act remove" data-remove="${esc(it.id)}" aria-label="${esc(rm)}" title="${esc(rm)}">${xSvg}</button>` : ''}
      </span>`;
  }

  // Rows are keyed by id; survivors glide to their new slot (FLIP), newcomers rise in, leavers fade out.
  function renderHits(terms) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const listTop = hitsEl.getBoundingClientRect().top;
    const before = new Map();
    $$(':scope > li[data-id]', hitsEl).forEach(li => before.set(li.dataset.id, { li, top: li.getBoundingClientRect().top }));
    const entries = [
      ...(quick ? [{ id: 'quick', html: active => quickHtml(active) }] : []),
      ...results.slice(0, MAX_HITS).map(m => ({ id: m.it.id, html: active => hitHtml(m, terms, active) }))
    ];
    const keep = new Set();
    const nodes = entries.map((e, i) => {
      let li = before.get(e.id)?.li;
      if (!li) { li = document.createElement('li'); li.dataset.id = e.id; li.dataset.enter = '1'; }
      keep.add(e.id);
      li.innerHTML = e.html(i === activeIdx);
      return li;
    });
    const tail = [];
    if (results.length > MAX_HITS) {
      const more = document.createElement('li'); more.className = 'more'; more.textContent = `${results.length - MAX_HITS} more`; tail.push(more);
    } else if (!entries.length) {
      const empty = document.createElement('li'); empty.className = 'empty';
      if (scope === 'raindrop' && !rdToken) {
        empty.classList.add('connect');
        empty.innerHTML = '<span>Raindrop isn’t connected</span><button class="pill-btn" data-connect-rd>Add token</button>';
      } else empty.textContent = 'Nothing found';
      tail.push(empty);
    }
    hitsEl.replaceChildren(...nodes, ...tail);
    fixFavicons(hitsEl);
    if (reduce) return;

    let leaving = 0;
    before.forEach(({ li, top }, id) => {
      if (keep.has(id) || leaving++ > 24) return;
      li.removeAttribute('data-id');
      li.style.cssText = `position:absolute;left:0;right:0;top:${top - listTop}px;pointer-events:none`;
      hitsEl.appendChild(li);
      li.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.98)' }], { duration: 180, easing: 'ease-out' }).onfinish = () => li.remove();
    });
    let entering = 0;
    nodes.forEach(li => {
      if (li.dataset.enter) {
        delete li.dataset.enter;
        li.animate(
          [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'none' }],
          { duration: 420, delay: Math.min(entering++, 14) * 22, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      } else {
        const dy = before.get(li.dataset.id).top - li.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
  }

  const rowEls = () => $$(':scope > li[data-id] .hit', hitsEl);
  function setActive(i, flash = false) {
    const rows = rowEls();
    if (!rows.length) return;
    activeIdx = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach((r, j) => { r.classList.toggle('active', j === activeIdx); r.classList.remove('flash'); });
    const row = rows[activeIdx];
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (flash) { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1400); }
  }
  hitsEl.addEventListener('click', e => {
    if (e.target.closest('[data-connect-rd]')) { e.stopPropagation(); openRaindropSettings(); return; }
    if (e.target.closest('[data-quick]')) { doQuickAdd(); return; }
    const pin = e.target.closest('[data-pin]');
    if (pin) { const it = byId.get(pin.dataset.pin); if (it) togglePin(it); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) { const it = byId.get(rm.dataset.remove); if (it) removeItem(it); }
  });
  qInput.addEventListener('input', () => { quickState = ''; runSearch(); });
  qInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
    else if (e.key === 'Enter') { rowEls()[Math.max(activeIdx, 0)]?.click(); }
    else if (e.key === 'Escape') { if (qInput.value) { qInput.value = ''; runSearch(); } else qInput.blur(); }
  });
  $('#insp-clear').addEventListener('click', () => { qInput.value = ''; runSearch(); qInput.focus(); });
  $('#insp-filters').addEventListener('click', e => {
    const p = e.target.closest('[data-cat]'); if (!p) return;
    activeCat = p.dataset.cat; runSearch();
  });
  $('#insp-shuffle').addEventListener('click', () => {
    const n = Math.min(results.length, MAX_HITS), offset = quick ? 1 : 0;
    if (n) setActive(offset + Math.floor(Math.random() * n), true);
  });

  synced.get('links.listen').then(v => {
    if (v && JSON.stringify(v) !== JSON.stringify(linkGroups)) { linkGroups = v; local.set('softtab.links.listen', v); buildIndex(); }
  });
  synced.get('pins').then(v => {
    if (v && JSON.stringify(v) !== JSON.stringify(pins)) { pins = v; local.set('softtab.pins', v); buildIndex(); }
  });
  synced.get('yt.channels').then(v => {
    if (v && JSON.stringify(v) !== JSON.stringify(ytChannels)) { ytChannels = v; local.set('softtab.yt.channels', v); refreshYouTube(true); }
  });

  /* ---------- Music: preset radio ---------- */
  // Each preset is something to launch: a live station (showing what's on air when the station publishes it)
  // or a channel/account (showing its latest posts). Softtab doesn't play audio; Listen opens the source.
  const KIND_LABEL = { live: 'Live', youtube: 'YouTube', soundcloud: 'SoundCloud', mixcloud: 'Mixcloud', nts: 'NTS', link: 'Link' };
  const KIND_GLYPH = {
    live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>',
    nts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'
  };
  const kindIcon = k => KIND_GLYPH[k] || (typeof BRAND_ICONS !== 'undefined' && BRAND_ICONS[k]
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${BRAND_ICONS[k].d}"/></svg>` : '');
  const PRESET_DEFAULTS = LOCAL_DEFAULTS.presets || [
    { kind: 'live', name: 'FIP', url: 'https://www.radiofrance.fr/fip', meta: 'fip' },
    { kind: 'live', name: 'NTS 1', url: 'https://www.nts.live/', meta: 'nts1' },
    { kind: 'live', name: 'NTS 2', url: 'https://www.nts.live/', meta: 'nts2' },
    { kind: 'live', name: 'KEXP', url: 'https://www.kexp.org/', meta: 'kexp' },
    null,
    null
  ];
  const PER_ROW = 6;
  let presets = local.get('softtab.presets', null) || structuredClone(PRESET_DEFAULTS);
  // Rows beyond the first exist only while they hold something.
  function trimRows() {
    while (presets.length > PER_ROW && presets.slice(-PER_ROW).every(p => !p)) presets.splice(-PER_ROW);
    if (presetIdx >= presets.length || !presets[presetIdx]) presetIdx = Math.max(0, presets.findIndex(Boolean));
  }
  const savePresets = () => { local.set('softtab.presets', presets); synced.set('presets', presets); };
  let presetIdx = local.get('softtab.preset', 0);
  if (!presets[presetIdx]) presetIdx = Math.max(0, presets.findIndex(Boolean));
  let editingPresets = false;
  let programming = null, feedSel = 0, progHits = [], progLink = null, progTimer = 0, progSeq = 0;
  // Favorites: individual posts or links kept in one list, alongside the presets.
  const FAVORITE_DEFAULTS = LOCAL_DEFAULTS.favorites || [];
  let favorites = local.get('softtab.favorites', null) || structuredClone(FAVORITE_DEFAULTS);  // [{ t, u, s }]
  const saveFavorites = () => { local.set('softtab.favorites', favorites); synced.set('favorites', favorites); };
  let viewFav = local.get('softtab.viewFav', false), favAdding = false;
  const isFav = u => favorites.some(f => f.u === u);
  const STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';
  function toggleFav(item, source) {
    const i = favorites.findIndex(f => f.u === item.u);
    if (i >= 0) favorites.splice(i, 1);
    else favorites.unshift({ t: item.t, u: item.u, s: source });
    saveFavorites(); renderPresets(); renderLcd();
  }
  async function linkTitle(u) {
    const h = host(u);
    const oembed = /(^|\.)youtube\.com$|^youtu\.be$/.test(h) ? 'https://www.youtube.com/oembed?format=json&url='
      : h === 'soundcloud.com' ? 'https://soundcloud.com/oembed?format=json&url='
      : /(^|\.)mixcloud\.com$/.test(h) ? 'https://www.mixcloud.com/oembed/?format=json&url=' : '';
    if (oembed) {
      try { const d = await getJSON(oembed + encodeURIComponent(u)); if (d.title) return { t: d.title, s: d.author_name || '' }; } catch {}
    }
    return { t: h + new URL(u).pathname.replace(/\/$/, ''), s: '' };
  }
  const radioCache = {};
  const presetKey = p => p.kind + ':' + (p.meta || p.uid || p.path || p.user || p.alias || p.url);

  const ago = t => {
    if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    if (s < 86400 * 14) return Math.round(s / 86400) + 'd';
    if (s < 86400 * 60) return Math.round(s / 604800) + 'w';
    if (s < 86400 * 365) return Math.round(s / 2592000) + 'mo';
    return Math.round(s / 31536000) + 'y';
  };
  const decodeEntities = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  async function onAir(p) {
    if (p.meta === 'fip') {
      const d = await getJSON('https://api.radiofrance.fr/livemeta/live/7/webrf_fip_player');
      const n = d.now || {};
      return { line: n.firstLine, sub: n.secondLine, start: n.startTime ? n.startTime * 1000 : 0, end: n.endTime ? n.endTime * 1000 : 0, clock: 'track' };
    }
    if (p.meta === 'nts1' || p.meta === 'nts2') {
      const d = await getJSON('https://www.nts.live/api/v2/live');
      const ch = d.results.find(r => r.channel_name === (p.meta === 'nts1' ? '1' : '2'));
      const det = ch?.now?.embeds?.details || {};
      const detail = [(det.genres || []).slice(0, 3).map(g => g.value).join(' · '), det.location_long].filter(Boolean);
      return {
        line: ch?.now?.broadcast_title, sub: ch?.next?.broadcast_title ? 'Next · ' + ch.next.broadcast_title : '', detail,
        start: Date.parse(ch?.now?.start_timestamp || '') || 0, end: Date.parse(ch?.now?.end_timestamp || '') || 0, clock: 'show'
      };
    }
    if (p.meta === 'kexp') {
      const plays = (await getJSON('https://api.kexp.org/v2/plays/?limit=4')).results || [];
      const x = plays[0];
      const before = plays.slice(1).find(p2 => p2.play_type === 'trackplay');
      const prev = before ? `Before · ${before.song} — ${before.artist}` : '';
      return x?.play_type === 'trackplay' ? { line: x.song, sub: x.artist, detail: [x.album, prev].filter(Boolean) } : { line: 'Air break', detail: [prev].filter(Boolean) };
    }
    return null;
  }
  async function latest(p) {
    if (p.kind === 'youtube') {
      return (await fetchChannel(p.path)).videos.slice(0, 5)
        .map(v => ({ t: v.title, u: 'https://www.youtube.com/watch?v=' + v.id, age: (v.age || '').replace(/\s*ago$/, '') }));
    }
    if (p.kind === 'soundcloud') {
      const r = await fetch(`https://feeds.soundcloud.com/users/soundcloud:users:${p.uid}/sounds.rss`);
      if (!r.ok) throw new Error(String(r.status));
      const doc = new DOMParser().parseFromString(await r.text(), 'text/xml');
      return [...doc.querySelectorAll('item')].slice(0, 5).map(it => ({
        t: it.querySelector('title')?.textContent || '', u: it.querySelector('link')?.textContent || p.url,
        age: ago(Date.parse(it.querySelector('pubDate')?.textContent || ''))
      }));
    }
    if (p.kind === 'mixcloud') {
      return (await getJSON(`https://api.mixcloud.com/${p.user}/cloudcasts/?limit=5`)).data
        .map(c => ({ t: c.name, u: c.url, age: ago(Date.parse(c.created_time)) }));
    }
    if (p.kind === 'nts') {
      const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
      return (await getJSON(`https://www.nts.live/api/v2/shows/${p.alias}/episodes?limit=5`)).results
        .map(e => ({ t: `${e.name} · ${fmt.format(new Date(e.broadcast))}`, u: `https://www.nts.live/shows/${p.alias}/episodes/${e.episode_alias}`, age: ago(Date.parse(e.broadcast)) }));
    }
    return null;
  }
  const inflight = new Set(), lastRetry = {};
  async function loadPreset(p, force = false) {
    if (!p || p.kind === 'link') return;
    const key = presetKey(p);
    if (inflight.has(key)) return;
    if (!radioCache[key] && p.kind !== 'live') {
      const stored = local.get('softtab.radio.' + key, null);
      if (stored) { radioCache[key] = stored; renderLcd(); }
    }
    const c = radioCache[key], ttl = p.kind === 'live' ? 30e3 : 15 * 60e3;
    if (!force && c && !c.error && Date.now() - c.at < ttl) return;
    inflight.add(key);
    try {
      const data = p.kind === 'live' ? await onAir(p) : await latest(p);
      radioCache[key] = { at: Date.now(), data };
      if (p.kind !== 'live') local.set('softtab.radio.' + key, radioCache[key]);
    } catch {
      radioCache[key] = { at: Date.now(), data: c?.data ?? null, error: true };
    } finally {
      inflight.delete(key);
    }
    // Redraw only when something changed, so the equalizer isn't restarted for nothing.
    const fresh = radioCache[key];
    const changed = !c || JSON.stringify(fresh.data) !== JSON.stringify(c.data) || !!fresh.error !== !!c.error;
    const cur = presets[presetIdx];
    if (changed && cur && presetKey(cur) === key && programming === null && !viewFav) renderLcd();
  }

  function renderPresets() {
    $('#presets').style.setProperty('--rows', Math.ceil(presets.length / PER_ROW));
    $('#add-row').hidden = !editingPresets || programming !== null;
    const eb = $('#edit-presets');
    eb.setAttribute('aria-pressed', String(editingPresets));
    eb.setAttribute('aria-label', editingPresets ? 'Done editing' : 'Edit presets');
    $('span', eb).textContent = editingPresets ? 'Done' : 'Edit presets';
    $('#presets').innerHTML = `
      <button class="preset fav-tile" data-fav-tile aria-pressed="${viewFav && programming === null}" aria-label="Favorites, ${favorites.length}">
        <span class="n"><span class="num">${favorites.length}</span><span class="star">${STAR}</span></span>
        <span class="s">Favorites</span>
      </button>` + presets.map((p, i) => `
      <button class="preset${p ? '' : ' empty'}${programming === i ? ' programming' : ''}" data-slot="${i}" aria-pressed="${i === presetIdx && programming === null && !viewFav && !!p}"
        ${p && editingPresets ? 'draggable="true"' : ''} aria-label="${p ? `Preset ${i + 1}, ${esc(p.name)}, ${KIND_LABEL[p.kind]}` : `Preset ${i + 1}, empty`}">
        <span class="n"><span class="num">${i + 1}</span>${p ? `<span class="corner"><span class="kind">${kindIcon(p.kind)}</span><span class="clear" data-clear="${i}" title="Clear">${xSvg}</span></span>` : ''}</span>
        <span class="s">${p ? esc(p.name) : '+'}</span>
      </button>`).join('');
  }
  function renderLcd() {
    const lcd = $('#lcd'), listen = $('#listen');
    if (programming !== null) return renderProgram();
    if (viewFav) return renderFavorites();
    const p = presets[presetIdx];
    if (!p) { lcd.innerHTML = '<div class="lcd-dim">No presets</div>'; listen.setAttribute('aria-disabled', 'true'); return; }
    listen.href = p.url;
    listen.removeAttribute('aria-disabled');
    const c = radioCache[presetKey(p)];
    let body = '';
    if (p.kind === 'live') {
      const d = c?.data;
      const now = d?.line
        ? `<div class="lcd-now"><span class="line">${esc(d.line)}</span>${d.sub ? `<small>${esc(d.sub)}</small>` : ''}</div>`
        : `<div class="lcd-now">${p.meta && !c ? '<small>Tuning…</small>' : ''}</div>`;
      const detail = [].concat(d?.detail || []).map(x => `<span>${esc(x)}</span>`).join('');
      body = `<div class="lcd-info">${now}<div class="lcd-detail">${detail}</div></div>`
        + `<div class="lcd-signal"><canvas id="lcd-signal" aria-hidden="true"></canvas></div>`
        + '<div class="lcd-progress" id="lcd-progress"></div>';
    } else if (p.kind === 'link') {
      body = `<div class="lcd-dim">${esc(host(p.url))}</div>`;
    } else {
      const items = c?.data;
      feedSel = Math.min(feedSel, Math.max(0, (items?.length || 1) - 1));
      body = items?.length
        ? `<ol class="lcd-feed">${items.map((it, i) => `<li class="${i === feedSel ? 'on' : ''}"><a href="${esc(it.u)}"><span class="caret">›</span><span class="t">${esc(it.t)}</span><span class="age">${esc(it.age || '')}</span></a><button class="row-act${isFav(it.u) ? ' on' : ''}" data-star="${i}" aria-pressed="${isFav(it.u)}" aria-label="${isFav(it.u) ? 'Remove from' : 'Add to'} favorites">${STAR}</button></li>`).join('')}</ol>`
        : `<div class="lcd-dim">${c ? (c.error ? `Can’t reach ${KIND_LABEL[p.kind]}` : 'Nothing yet') : 'Loading…'}</div>`;
    }
    const tag = p.kind === 'live' ? '<span class="air"></span>On air' : KIND_LABEL[p.kind];
    lcd.innerHTML = `<div class="lcd-head"><div class="lcd-name">${esc(p.name)}</div><div class="lcd-tag">${tag}</div></div>${body}`;
    renderProgress();
  }

  // Song or show progress as a row of LCD dots.
  const PROGRESS_DOTS = 48;
  function renderProgress() {
    const el = $('#lcd-progress'), p = presets[presetIdx];
    if (!el || !p || viewFav) return;
    const d = radioCache[presetKey(p)]?.data;
    if (!d?.start || !d?.end) return;
    const now = Date.now(), frac = Math.max(0, Math.min(1, (now - d.start) / (d.end - d.start)));
    const lit = Math.round(frac * PROGRESS_DOTS);
    const mmss = ms => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
    const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
    const label = d.clock === 'track'
      ? `${mmss(Math.min(now, d.end) - d.start)} / ${mmss(d.end - d.start)}`
      : `${hm.format(d.start)}–${hm.format(d.end)} · ${Math.max(0, Math.round((d.end - now) / 60000))} min left`;
    if (el.childElementCount !== PROGRESS_DOTS + 1) {
      el.innerHTML = '<span class="dots">' + '<i></i>'.repeat(PROGRESS_DOTS) + '</span>';
      el.insertAdjacentHTML('beforeend', '<span class="time"></span>');
    }
    $$('.dots i', el).forEach((dot, i) => dot.classList.toggle('lit', i < lit));
    $('.time', el).textContent = label;
    const key = presetKey(p);
    if (now > d.end + 5000 && now - (lastRetry[key] || 0) > 15000) {  // ended: ask what's on now, without hammering the station
      lastRetry[key] = now;
      loadPreset(p, true);
    }
  }

  // A dot-matrix graphic equalizer under live stations. Decorative: Softtab doesn't play the audio,
  // so the bars follow a made-up beat (bass kicks, fast attack, slow fall, peak dots that hang then drop).
  // Levels are continuous and animate every frame; the top dot of each bar fades with the fractional level.
  const signalReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const BAND_W = 2;  // dot columns per bar, then one empty column
  let eq = { bands: 0, level: [], target: [], peak: [], hold: [], lastPick: 0, lastFrame: 0 };
  function pickTargets(t) {
    const kick = (t % 0.48) / 0.48 < 0.14;
    for (let b = 0; b < eq.bands; b++) {
      const x = b / eq.bands;
      let target;
      if (signalReduce.matches) target = 0.55 - 0.35 * x;
      else {
        target = (0.78 - 0.42 * x) * (0.3 + 0.7 * Math.pow(Math.random(), 1.6)) + 0.12 * Math.sin(t * 0.9 + b * 0.7);
        if (kick && x < 0.28) target += 0.35 * (1 - x / 0.28);
        if (Math.random() < 0.04) target += 0.3;
      }
      eq.target[b] = Math.max(0.04, Math.min(1, target));
    }
  }
  function drawSignal(ts) {
    const canvas = $('#lcd-signal');
    const dt = Math.min(64, ts - (eq.lastFrame || ts));
    eq.lastFrame = ts;
    if (canvas && mode === 'music' && !document.hidden) {
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (r.width > 0 && r.height > 0) {
        if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) {
          canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
        }
        const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
        const pitch = 8 * dpr, rad = 1.6 * dpr;
        const cols = Math.floor(w / pitch), rows = Math.max(2, Math.floor(h / pitch));
        const bands = Math.max(1, Math.floor((cols + 1) / (BAND_W + 1)));
        if (eq.bands !== bands) eq = { ...eq, bands, level: new Array(bands).fill(0), target: new Array(bands).fill(0), peak: new Array(bands).fill(0), hold: new Array(bands).fill(0), lastPick: 0 };
        const t = ts / 1000;
        if (ts - eq.lastPick > 110) { eq.lastPick = ts; pickTargets(t); }
        const attack = 1 - Math.exp(-dt / 45), fall = dt * 0.0012, peakFall = dt * 0.0005;
        for (let b = 0; b < bands; b++) {
          const L = eq.level[b], T = eq.target[b];
          eq.level[b] = T > L ? L + (T - L) * attack : Math.max(T, L - fall);
          if (eq.level[b] >= eq.peak[b]) { eq.peak[b] = eq.level[b]; eq.hold[b] = 380; }
          else if (eq.hold[b] > 0) eq.hold[b] -= dt;
          else eq.peak[b] = Math.max(eq.level[b], eq.peak[b] - peakFall);
        }
        const cs = getComputedStyle(canvas);
        const ink = cs.getPropertyValue('--lcd-ink').trim(), off = cs.getPropertyValue('--lcd-line').trim();
        ctx.clearRect(0, 0, w, h);
        const x0 = (w - (bands * (BAND_W + 1) - 1) * pitch) / 2;
        const dot = (cx, rr, color, alpha = 1) => {
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(cx, h - (rr * pitch + pitch / 2), rad, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        };
        for (let b = 0; b < bands; b++) {
          const v = eq.level[b] * rows, full = Math.floor(v), frac = v - full;
          const peakRow = Math.min(rows - 1, Math.round(eq.peak[b] * rows));
          for (let k = 0; k < BAND_W; k++) {
            const cx = x0 + (b * (BAND_W + 1) + k) * pitch + pitch / 2;
            for (let rr = 0; rr < rows; rr++) {
              if (rr < full) dot(cx, rr, ink);
              else if (rr === full && frac > 0.02) { dot(cx, rr, off); dot(cx, rr, ink, frac); }
              else if (rr === peakRow && peakRow > full) dot(cx, rr, ink, 0.85);
              else dot(cx, rr, off);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
    }
    if (signalReduce.matches) setTimeout(() => requestAnimationFrame(drawSignal), 1000);
    else requestAnimationFrame(drawSignal);
  }
  setTimeout(() => requestAnimationFrame(drawSignal), 0);  // after start-up, once the current tab is known

  function renderFavorites() {
    const lcd = $('#lcd'), listen = $('#listen');
    feedSel = Math.min(feedSel, Math.max(0, favorites.length - 1));
    const sel = favorites[feedSel];
    if (sel && !favAdding) { listen.href = sel.u; listen.removeAttribute('aria-disabled'); } else listen.setAttribute('aria-disabled', 'true');
    const list = favorites.length
      ? `<ol class="lcd-feed scroll">${favorites.map((f, i) => `<li class="${i === feedSel ? 'on' : ''}"><a href="${esc(f.u)}"><span class="caret">›</span><span class="t">${esc(f.t)}</span><span class="age">${esc(f.s || host(f.u))}</span></a><button class="row-act remove" data-unfav="${i}" aria-label="Remove ${esc(f.t)}">${xSvg}</button></li>`).join('')}</ol>`
      : '<div class="lcd-dim">No favorites yet</div>';
    const foot = favAdding
      ? `<div class="lcd-prog"><input id="fav-q" type="text" placeholder="Paste a link" autocomplete="off" spellcheck="false" aria-label="Link to add"></div>
         <div class="lcd-actions"><button data-act="fav-cancel">Cancel</button></div>`
      : '<div class="lcd-actions"><button data-act="fav-add">Add a link</button></div>';
    lcd.innerHTML = `<div class="lcd-head"><div class="lcd-name">Favorites</div><div class="lcd-tag">${favorites.length}</div></div>${list}${foot}`;
    if (favAdding) {
      const q = $('#fav-q');
      q.addEventListener('keydown', async e => {
        if (e.key === 'Escape') { e.stopPropagation(); favAdding = false; renderFavorites(); return; }
        if (e.key !== 'Enter') return;
        const u = normalizeUrl(q.value);
        if (!u) { q.value = ''; q.placeholder = 'That doesn’t look like a link'; return; }
        q.disabled = true; q.value = 'Looking it up…';
        const meta = await linkTitle(u);
        if (!isFav(u)) favorites.unshift({ t: meta.t, u, s: meta.s });
        saveFavorites(); favAdding = false; feedSel = 0; renderPresets(); renderFavorites();
      });
      q.focus();
    }
  }

  // Programming a preset: paste a link (YouTube, SoundCloud, Mixcloud, NTS show, station site) or search the station directory.
  function detectSource(v) {
    if (v.startsWith('@') || /youtube\.com\/(@|channel\/)/i.test(v)) {
      const path = parseChannel(v);
      return path && { kind: 'youtube', path, label: path.replace(/^\/(channel\/)?/, '') };
    }
    if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v)) return null;
    let u;
    try { u = new URL(normalizeUrl(v)); } catch { return null; }
    const h = host(u.href), seg = u.pathname.split('/').filter(Boolean);
    if (h === 'soundcloud.com' && seg[0]) return { kind: 'soundcloud', user: seg[0], label: seg[0] };
    if (h === 'mixcloud.com' && seg[0]) return { kind: 'mixcloud', user: seg[0], label: seg[0] };
    if (h === 'nts.live' && seg[0] === 'shows' && seg[1]) return { kind: 'nts', alias: seg[1], label: seg[1].replace(/-/g, ' ') };
    if (h === 'nts.live') return { kind: 'live', meta: 'nts1', name: 'NTS 1', url: 'https://www.nts.live/', label: 'NTS 1' };
    if (/(^|\.)fip\.fr$/.test(h) || (h === 'radiofrance.fr' && seg[0] === 'fip')) return { kind: 'live', meta: 'fip', name: 'FIP', url: 'https://www.radiofrance.fr/fip', label: 'FIP' };
    if (/(^|\.)kexp\.org$/.test(h)) return { kind: 'live', meta: 'kexp', name: 'KEXP', url: 'https://www.kexp.org/', label: 'KEXP' };
    return { kind: 'link', url: u.href, label: h };
  }
  async function resolveSource(d) {
    if (d.kind === 'youtube') {
      const { name } = await fetchChannel(d.path);
      return { kind: 'youtube', name, path: d.path, url: 'https://www.youtube.com' + d.path };
    }
    if (d.kind === 'soundcloud') {
      const r = await fetch(`https://soundcloud.com/${d.user}`);
      if (!r.ok) throw new Error(String(r.status));
      const html = await r.text();
      const uid = (html.match(/soundcloud:\/\/users:(\d+)/) || [])[1];
      if (!uid) throw new Error('no user');
      const name = decodeEntities((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || d.user);
      return { kind: 'soundcloud', name, uid: Number(uid), user: d.user, url: `https://soundcloud.com/${d.user}` };
    }
    if (d.kind === 'mixcloud') {
      const u = await getJSON(`https://api.mixcloud.com/${d.user}/`);
      return { kind: 'mixcloud', name: u.name || d.user, user: d.user, url: u.url || `https://www.mixcloud.com/${d.user}/` };
    }
    if (d.kind === 'nts') {
      const s = await getJSON(`https://www.nts.live/api/v2/shows/${d.alias}`);
      return { kind: 'nts', name: s.name || d.label, alias: d.alias, url: `https://www.nts.live/shows/${d.alias}` };
    }
    if (d.kind === 'live') return { kind: 'live', name: d.name, url: d.url, meta: d.meta };
    return { kind: 'link', name: d.label, url: d.url };
  }
  const stationMeta = s => {
    const n = s.name.trim().toLowerCase(), h = (s.homepage || '').toLowerCase();
    if (n === 'fip') return 'fip';
    if (h.includes('nts.live')) return /2\b/.test(n) ? 'nts2' : 'nts1';
    if (h.includes('kexp.org')) return 'kexp';
    return '';
  };
  function renderProgram() {
    $('#listen').setAttribute('aria-disabled', 'true');
    $('#lcd').innerHTML = `
      <div class="lcd-head"><div class="lcd-name">Preset ${programming + 1}</div></div>
      ${presets[programming] ? `<div class="lcd-dim">Now · ${esc(presets[programming].name)} · ${KIND_LABEL[presets[programming].kind]}</div>` : ''}
      <div class="lcd-prog">
        <input id="prog-q" type="text" placeholder="${presets[programming] ? 'Replace with a link or station' : 'Paste a link or search radio stations'}" autocomplete="off" spellcheck="false" aria-label="Link or station name">
        <ul class="lcd-results" id="prog-res"></ul>
      </div>
      <div class="lcd-actions">${presets[programming] ? '<button data-act="clear">Clear preset</button>' : ''}<button data-act="cancel">Cancel</button></div>`;
    const q = $('#prog-q');
    q.addEventListener('input', onProgInput);
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); $('#prog-res button')?.click(); }
      if (e.key === 'Escape') { e.stopPropagation(); endProgram(); }
    });
    q.focus();
  }
  function onProgInput() {
    const v = $('#prog-q').value.trim(), res = $('#prog-res'), seq = ++progSeq;
    clearTimeout(progTimer);
    progLink = null;
    if (!v) { res.innerHTML = ''; return; }
    const link = detectSource(v);
    if (link) {
      progLink = link;
      res.innerHTML = `<li><button data-link class="on"><span>${esc(link.label)}</span><span class="w">${KIND_LABEL[link.kind]}</span></button></li>`;
      return;
    }
    progTimer = setTimeout(async () => {
      try {
        const list = await getJSON('https://de1.api.radio-browser.info/json/stations/search?' +
          new URLSearchParams({ name: v, limit: 20, hidebroken: 'true', order: 'clickcount', reverse: 'true' }));
        if (seq !== progSeq) return;
        // One row per station: the directory lists each stream quality separately.
        const seen = new Set();
        progHits = list.filter(st => {
          const k = st.homepage ? host(st.homepage) : st.name.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k); return true;
        });
        progHits = progHits.slice(0, 6);
        const list2 = progHits;
        res.innerHTML = list2.map((s, i) => `<li><button data-hit="${i}" class="${i === 0 ? 'on' : ''}">
          <span>${esc(s.name.trim())}</span><span class="w">${esc(s.countrycode || '')}</span></button></li>`).join('')
          || '<li class="lcd-dim">No station found</li>';
      } catch { if (seq === progSeq) res.innerHTML = '<li class="lcd-dim">Station directory unavailable</li>'; }
    }, 250);
  }
  function startProgram(i) { programming = i; renderPresets(); renderLcd(); }
  $('#edit-presets').addEventListener('click', () => {
    editingPresets = !editingPresets;
    if (!editingPresets) { if (programming !== null) endProgram(); trimRows(); savePresets(); }
    renderPresets(); renderLcd();
    // Switch the look a frame after the rebuild so the icons cross-fade instead of snapping.
    requestAnimationFrame(() => requestAnimationFrame(() => $('#radio').classList.toggle('editing', editingPresets)));
  });
  $('#add-row').addEventListener('click', () => {
    presets.push(...new Array(PER_ROW).fill(null));
    savePresets();
    startProgram(presets.length - PER_ROW);
  });
  function endProgram() {
    programming = null;
    const before = presets.length;
    trimRows();
    if (presets.length !== before) savePresets();
    renderPresets(); renderLcd();
    loadPreset(presets[presetIdx]);
  }
  function showFavorites() {
    programming = null; viewFav = true; favAdding = false; feedSel = 0;
    local.set('softtab.viewFav', true);
    renderPresets(); renderLcd();
  }
  function selectPreset(i) {
    presetIdx = i; feedSel = 0; viewFav = false;
    local.set('softtab.viewFav', false);
    local.set('softtab.preset', i);
    renderPresets(); renderLcd();
    loadPreset(presets[i]);
  }
  $('#lcd').addEventListener('click', async e => {
    const star = e.target.closest('[data-star]');
    if (star) {
      const p = presets[presetIdx], items = radioCache[presetKey(p)]?.data || [];
      const it = items[Number(star.dataset.star)];
      if (it) toggleFav(it, p.name);
      return;
    }
    const unfav = e.target.closest('[data-unfav]');
    if (unfav) { favorites.splice(Number(unfav.dataset.unfav), 1); saveFavorites(); renderPresets(); renderLcd(); return; }
    const favAct = e.target.closest('[data-act^="fav-"]');
    if (favAct) { favAdding = favAct.dataset.act === 'fav-add'; renderFavorites(); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'clear') {
        presets[programming] = null; savePresets();
        if (!presets[presetIdx]) presetIdx = Math.max(0, presets.findIndex(Boolean));
      }
      endProgram();
      return;
    }
    const hit = e.target.closest('[data-hit]'), link = e.target.closest('[data-link]');
    if (!hit && !link) return;
    const slot = programming;
    let src;
    if (link) {
      const label = $('span', link);
      label.textContent = 'Looking it up…';
      try { src = await resolveSource(progLink); }
      catch { label.textContent = 'Couldn’t read that page'; return; }
    } else {
      const s = progHits[Number(hit.dataset.hit)];
      src = { kind: 'live', name: s.name.trim(), url: s.homepage || s.url_resolved, meta: stationMeta(s) };
    }
    if (programming !== slot) return;
    presets[slot] = src; presetIdx = slot; feedSel = 0;
    savePresets(); local.set('softtab.preset', slot);
    endProgram();
  });

  // Press a preset to show it; hold (or press an empty one) to program it.
  let holdTimer = 0, held = false;
  $('#presets').addEventListener('pointerdown', e => {
    const b = e.target.closest('.preset[data-slot]'); if (!b) return;
    held = false; b.classList.add('holding');
    holdTimer = setTimeout(() => { held = true; b.classList.remove('holding'); startProgram(Number(b.dataset.slot)); }, 700);
  });
  const cancelHold = () => { clearTimeout(holdTimer); $$('.preset.holding').forEach(b => b.classList.remove('holding')); };
  $('#presets').addEventListener('pointerup', cancelHold);
  $('#presets').addEventListener('pointerleave', cancelHold);
  $('#presets').addEventListener('click', e => {
    if (e.target.closest('[data-fav-tile]')) { showFavorites(); return; }
    const b = e.target.closest('.preset[data-slot]'); if (!b || held) return;
    const i = Number(b.dataset.slot);
    if (e.target.closest('[data-clear]')) {
      presets[i] = null; trimRows(); savePresets(); renderPresets(); renderLcd(); return;
    }
    if (editingPresets) { startProgram(i); return; }
    if (!presets[i]) startProgram(i); else { programming = null; selectPreset(i); }
  });
  let dragFrom = null;
  $('#presets').addEventListener('dragstart', e => {
    const b = e.target.closest('.preset[data-slot]'); if (!b || !editingPresets) return;
    cancelHold();
    dragFrom = Number(b.dataset.slot);
    b.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  $('#presets').addEventListener('dragover', e => {
    const b = e.target.closest('.preset[data-slot]');
    if (!b || dragFrom === null) return;
    e.preventDefault();
    $$('.preset.drop-target').forEach(x => { if (x !== b) x.classList.remove('drop-target'); });
    if (Number(b.dataset.slot) !== dragFrom) b.classList.add('drop-target');
  });
  $('#presets').addEventListener('dragleave', e => {
    const b = e.target.closest('.preset[data-slot]');
    if (b && !b.contains(e.relatedTarget)) b.classList.remove('drop-target');
  });
  $('#presets').addEventListener('drop', e => {
    const b = e.target.closest('.preset[data-slot]');
    if (!b || dragFrom === null) return;
    e.preventDefault();
    const to = Number(b.dataset.slot), from = dragFrom;
    if (to !== from) {
      [presets[from], presets[to]] = [presets[to], presets[from]];
      if (presetIdx === from) presetIdx = to; else if (presetIdx === to) presetIdx = from;
      trimRows(); savePresets(); local.set('softtab.preset', presetIdx);
    }
    dragFrom = null;
    renderPresets(); renderLcd();
  });
  $('#presets').addEventListener('dragend', () => {
    dragFrom = null;
    $$('.preset.dragging, .preset.drop-target').forEach(x => x.classList.remove('dragging', 'drop-target'));
  });

  function musicKey(e) {
    if (e.key === 'Escape' && editingPresets && programming === null) { $('#edit-presets').click(); return; }
    if (programming !== null) return;
    if ((e.key === 'e' || e.key === 'E') && !viewFav && presets[presetIdx]) { startProgram(presetIdx); return; }
    const list = viewFav ? favorites : radioCache[presetKey(presets[presetIdx] || {})]?.data;
    if ((e.key === 'f' || e.key === 'F') && !viewFav && Array.isArray(list) && list[feedSel]) {
      toggleFav(list[feedSel], presets[presetIdx].name); return;
    }
    if (viewFav && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (!favorites.length) return;
      e.preventDefault();
      feedSel = Math.max(0, Math.min(favorites.length - 1, feedSel + (e.key === 'ArrowDown' ? 1 : -1)));
      renderLcd(); $('.lcd-feed li.on')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    const filled = presets.map((p, i) => p ? i : -1).filter(i => i >= 0);
    const at = filled.indexOf(presetIdx);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = viewFav ? filled[e.key === 'ArrowRight' ? 0 : filled.length - 1] : filled[(at + (e.key === 'ArrowRight' ? 1 : -1) + filled.length) % filled.length];
      if (next !== undefined) selectPreset(next);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = radioCache[presetKey(presets[presetIdx] || {})]?.data;
      if (!Array.isArray(items) || !items.length) return;
      e.preventDefault();
      feedSel = Math.max(0, Math.min(items.length - 1, feedSel + (e.key === 'ArrowDown' ? 1 : -1)));
      renderLcd();
    } else if (e.key === 'Enter') {
      ($('.lcd-feed li.on a') || $('#listen')).click();
    }
  }
  synced.get('presets').then(v => {
    if (v && JSON.stringify(v) !== JSON.stringify(presets)) {
      presets = v; local.set('softtab.presets', v);
      if (!presets[presetIdx]) presetIdx = Math.max(0, presets.findIndex(Boolean));
      renderPresets(); renderLcd();
      if (mode === 'music') loadPreset(presets[presetIdx]);
    }
  });
  synced.get('favorites').then(v => {
    if (v && JSON.stringify(v) !== JSON.stringify(favorites)) { favorites = v; local.set('softtab.favorites', v); renderPresets(); renderLcd(); }
  });
  renderPresets();
  renderLcd();

  /* ---------- Modes ---------- */
  const BUILTIN_MODES = ['weather', 'subway', 'raindrop', 'music'];
  const allModes = () => [...BUILTIN_MODES, ...boards.map(b => 'board:' + b.id)];
  const visibleModes = () => allModes().filter(m => !hiddenTabs.includes(m));
  const RENAMED_MODES = { quiet: 'weather', inspiration: 'raindrop', work: 'board:work' };
  const firstBoardMode = () => {
    const vis = visibleModes();
    return vis.includes('board:work') ? 'board:work' : vis.find(m => m.startsWith('board:')) || vis[0] || 'weather';
  };
  let mode = null;
  function setMode(m, save = true) {
    if (!visibleModes().includes(m)) m = visibleModes()[0] || 'weather';
    const leavingBoard = mode !== m && mode?.startsWith('board:');
    mode = m;
    const section = m.startsWith('board:') ? 'board' : m;
    $$('.mode-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    $$('section.mode').forEach(s => { s.hidden = s.dataset.mode !== section; });
    if (m.startsWith('board:')) {
      if (leavingBoard || boardId !== m.slice(6)) { catEditing = null; boardForm = null; }
      boardId = m.slice(6);
      renderBoard();
    }
    if (save) local.set('softtab.mode', m);
    if (m === 'subway') {
      if (Date.now() - (subway.updated[trip] || 0) > 20000) refreshSubway();
      if (Date.now() - alertsUpdated > 120000) refreshAlerts();
    }
    if (m === 'music' && !viewFav) loadPreset(presets[presetIdx]);
    if (m === 'raindrop') {
      const finder = $('.finder');
      if (scope !== m || finder.parentElement.dataset.mode !== m) {
        scope = m; activeCat = 'All'; qInput.value = ''; quick = null; quickState = '';
        $(`section.mode[data-mode="${m}"]`).appendChild(finder);
        hitsEl.replaceChildren();
        buildIndex();
      }
      refreshRaindrop();
    }
  }
  $('.switcher').addEventListener('click', e => { const b = e.target.closest('.mode-btn'); if (b) setMode(b.dataset.mode); });


  /* ---------- Tabs (settings) ---------- */
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.4 7.4C3.9 9.2 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/></svg>';
  function tabInfo(m) {
    if (m.startsWith('board:')) { const b = boards.find(x => x.id === m.slice(6)); return { name: b?.name || '', icon: boardIcon(b?.icon), board: true }; }
    const btn = $(`.mode-btn[data-mode="${m}"]`);
    return { name: btn?.querySelector('.label')?.textContent || m, icon: btn?.querySelector('svg')?.outerHTML || '', board: false };
  }
  let iconPickFor = null, expandedTab = null;
  const TAB_SETTINGS = { raindrop: '#raindrop-form' };  // tabs with their own settings, shown when the row is expanded
  const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>';
  function renderTabList() {
    const vis = visibleModes();
    // Park the settings forms before the list is rebuilt, so their state and listeners survive.
    Object.values(TAB_SETTINGS).forEach(sel => $('#tab-settings-holder').appendChild($(sel)));
    $('#tab-list').innerHTML = allModes().map(m => {
      const t = tabInfo(m), shown = !hiddenTabs.includes(m), last = shown && vis.length === 1;
      const icon = t.board
        ? `<button class="ico pick" data-pick-icon="${esc(m)}" aria-expanded="${iconPickFor === m}" aria-label="Change icon" title="Change icon">${t.icon}</button>`
        : `<span class="ico">${t.icon}</span>`;
      const warn = m === 'raindrop' && !rdToken ? '<span class="row-dot" title="Not connected"></span>' : '';
      const name = t.board
        ? `<input class="tab-name" data-rename="${esc(m)}" value="${esc(t.name)}" aria-label="Tab name" spellcheck="false">`
        : `<span class="name">${esc(t.name)}${warn}</span>`;
      const expand = TAB_SETTINGS[m]
        ? `<button class="tab-act expand" data-expand-tab="${esc(m)}" aria-expanded="${expandedTab === m}" aria-label="${esc(t.name)} settings" title="Settings">${CHEVRON}</button>`
        : '';
      const picker = iconPickFor === m ? `<li class="icon-grid" role="radiogroup" aria-label="Icon">${Object.keys(BOARD_ICONS).map(k =>
        `<button role="radio" aria-checked="${k === boards.find(b => 'board:' + b.id === m)?.icon}" data-set-icon="${k}" aria-label="${k}" title="${k}">${boardIcon(k)}</button>`).join('')}</li>` : '';
      const panel = TAB_SETTINGS[m] && expandedTab === m ? `<li class="tab-panel" data-panel="${esc(m)}"></li>` : '';
      return `<li class="tab-row${shown ? '' : ' off'}">
        ${icon}${name}
        <button class="tab-act" data-toggle-tab="${esc(m)}" aria-pressed="${shown}" ${last ? 'disabled' : ''}
          aria-label="${shown ? 'Hide' : 'Show'} ${esc(t.name)}" title="${shown ? 'Hide' : 'Show'}">${shown ? EYE : EYE_OFF}</button>
        ${t.board ? `<button class="tab-act danger" data-delete-tab="${esc(m)}" aria-label="Delete ${esc(t.name)}" title="Delete">${xSvg}<span class="lbl">Delete</span></button>` : expand || '<span class="tab-act-spacer"></span>'}
      </li>${picker}${panel}`;
    }).join('') + `<li><button class="tab-row new-tab" data-new-tab><span class="ico">${PLUS}</span><span class="name">New tab</span></button></li>`;
    if (expandedTab && TAB_SETTINGS[expandedTab]) $(`[data-panel="${expandedTab}"]`)?.appendChild($(TAB_SETTINGS[expandedTab]));
  }
  const disarmDeletes = except => $$('.tab-act.confirm, .x.confirm').forEach(x => {
    if (x === except) return;
    x.classList.remove('confirm'); x.setAttribute('aria-label', x.dataset.label);
  });
  // Any other click (or closing settings) cancels an armed Delete.
  document.addEventListener('click', e => { if (!e.target.closest('.tab-act.confirm, .x.confirm')) disarmDeletes(); }, true);
  $('#tab-list').addEventListener('input', e => {
    const input = e.target.closest('[data-rename]'); if (!input) return;
    const b = boards.find(x => 'board:' + x.id === input.dataset.rename); if (!b) return;
    b.name = input.value.trim() || 'Untitled';
    saveBoards(); renderSwitcherBoards();
    if (mode === input.dataset.rename) $(`.mode-btn[data-mode="${mode}"]`)?.setAttribute('aria-selected', 'true');
  });
  $('#tab-list').addEventListener('keydown', e => { if (e.target.closest('[data-rename]') && e.key === 'Enter') e.target.blur(); });
  $('#tab-list').addEventListener('click', e => {
    e.stopPropagation();
    const exp = e.target.closest('[data-expand-tab]');
    if (exp) { expandedTab = expandedTab === exp.dataset.expandTab ? null : exp.dataset.expandTab; renderTabList(); return; }
    const pick = e.target.closest('[data-pick-icon]');
    if (pick) { iconPickFor = iconPickFor === pick.dataset.pickIcon ? null : pick.dataset.pickIcon; renderTabList(); return; }
    const setIcon = e.target.closest('[data-set-icon]');
    if (setIcon) {
      const b = boards.find(x => 'board:' + x.id === iconPickFor);
      if (b) { b.icon = setIcon.dataset.setIcon; saveBoards(); renderSwitcherBoards(); }
      iconPickFor = null; renderTabList();
      if (mode) $(`.mode-btn[data-mode="${mode}"]`)?.setAttribute('aria-selected', 'true');
      return;
    }
    const tog = e.target.closest('[data-toggle-tab]');
    if (tog) {
      const m = tog.dataset.toggleTab;
      hiddenTabs = hiddenTabs.includes(m) ? hiddenTabs.filter(x => x !== m) : [...hiddenTabs, m];
      saveHidden(); renderSwitcherBoards(); renderTabList(); syncRaindropState();
      if (mode === m && hiddenTabs.includes(m)) setMode(visibleModes()[0]);
      return;
    }
    const del = e.target.closest('[data-delete-tab]');
    if (del) {
      // Deleting asks twice: the first click arms the button for 3 seconds.
      if (!del.classList.contains('confirm')) {
        disarmDeletes(del);
        del.dataset.label = del.getAttribute('aria-label');
        del.classList.add('confirm'); del.setAttribute('aria-label', 'Confirm delete');
        return;
      }
      const m = del.dataset.deleteTab;
      boards = boards.filter(b => 'board:' + b.id !== m);
      hiddenTabs = hiddenTabs.filter(x => x !== m);
      saveBoards(); saveHidden(); renderSwitcherBoards(); renderTabList();
      if (mode === m) setMode(visibleModes()[0]);
      return;
    }
    if (e.target.closest('[data-new-tab]')) { togglePop(false); newBoard(); }
  });
  synced.get('hiddenTabs').then(v => {
    if (Array.isArray(v) && JSON.stringify(v) !== JSON.stringify(hiddenTabs)) {
      hiddenTabs = v; local.set('softtab.hiddenTabs', v); renderSwitcherBoards(); renderTabList();
      if (mode && hiddenTabs.includes(mode)) setMode(visibleModes()[0]);
    }
  });

  /* ---------- Settings popover ---------- */
  const sBtn = $('#settings-btn'), pop = $('#settings');
  function togglePop(open) { pop.hidden = !open; $('#scrim').hidden = !open; sBtn.setAttribute('aria-expanded', String(open)); }
  sBtn.addEventListener('click', e => { e.stopPropagation(); togglePop(pop.hidden); });
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) togglePop(false); });

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') togglePop(false);
    if (e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= visibleModes().length) setMode(visibleModes()[n - 1]);
    if (e.key === 't' || e.key === 'T') cycleTheme();
    if (mode === 'music') musicKey(e);
    if (e.key === '/' && mode === 'raindrop') { e.preventDefault(); qInput.focus(); }
  });

  /* ---------- Start ---------- */
  renderTripBar();
  setTrip(trip);
  renderSwitcherBoards();
  renderTabList();
  const savedMode = local.get('softtab.mode', 'weather');
  const saved = RENAMED_MODES[savedMode] || savedMode;
  buildIndex();
  setMode(saved, false);
  secret.get('raindropToken').then(t => {
    rdToken = t;
    $('#raindrop-token').value = t;
    syncRaindropState();
    if (mode === 'raindrop') buildIndex();
    if (mode === 'raindrop') { refreshRaindrop(); buildIndex(); }
  });
  refreshWeather();

  function tick() {
    const now = new Date();
    tickQuiet(now);
    if (mode === 'subway') renderSubway(now.getTime());
    if (mode === 'music') renderProgress();
  }
  tick();
  setInterval(tick, 1000);
  setInterval(() => {
    if (document.hidden) return;
    if (mode === 'subway') refreshSubway();
    if (mode === 'subway' && Date.now() - alertsUpdated > 120000) refreshAlerts();
    if (mode === 'music' && presets[presetIdx]?.kind === 'live') loadPreset(presets[presetIdx], true);
  }, 30000);
  setInterval(() => { if (!document.hidden) refreshWeather(); }, 15 * 60e3);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (mode === 'subway') refreshSubway();
    refreshWeather();
  });
})();
