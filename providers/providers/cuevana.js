/**
 * Cuevana (wv3.cuevana3.eu) - OwnTV provider pack
 *
 * Latino / Castellano / English links for films and series from Cuevana, resolved down to a playable
 * address (StreamWish, VidHide, VOE, DoodStream...) and checked with a short playlist probe, so a dead
 * server is never offered.
 *
 * Port of lolapp's CuevanaService (https://github.com/jostinsantos/lolapp, lib/data/extractors/providers/
 * cuevana_extractor.dart) and its hoster resolvers (lib/data/extractors/hls/hls_extractor.dart), GPL-3.0.
 * Contract: Nuvio provider (getStreams(tmdbId, mediaType, season, episode) -> streams[]).
 */
var SITE = {
  name: 'Cuevana',
  base: 'https://wv3.cuevana3.eu',
  playerFallbacks: ['https://player.poseidonhd2.co'],
  domainMap: { 'streamwish.to': 'hgplaycdn.com', 'vidhidepro.com': 'callistanise.com', 'filelions.to': 'callistanise.com' },
  pages: function (t, tv, season, episode) {
    var out = [];
    t.titles.forEach(function (title) {
      var slug = slugify(title);
      if (!slug) return;
      if (tv) {
        out.push(SITE.base + '/episodio/' + slug + '-temporada-' + season + '-episodio-' + episode);
      } else {
        out.push(SITE.base + '/ver-pelicula/' + slug);
        if (t.year) out.push(SITE.base + '/ver-pelicula/' + slug + '-' + t.year);
      }
    });
    return out.filter(function (u, i) { return out.indexOf(u) === i; });
  },
};

// ---- begin _lib.js ----
// ---- OwnTV provider pack: shared helpers -----------------------------------------------------------
// Not a provider. tools/build.py inlines this file into every providers/<id>.js, because a Nuvio scraper
// has to be ONE self-contained file (there is no module system between scrapers).
//
// Parts adapted from lolapp (https://github.com/jostinsantos/lolapp, lib/data/extractors/hls/hls_extractor.dart: the hoster
// resolvers for StreamWish / VidHide / VOE / DoodStream / Lulustream / GoodStream / DropCDN / OK.ru and the
// idea of checking a stream before offering it), GPL-3.0, credited in README.md and the repository NOTICE.

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
var LANG_LATINO = 'Latino';
var LANG_CASTELLANO = 'Castellano';
var LANG_SUBTITULADO = 'Subtitulado';
var LANG_INGLES = 'Ingl\u00e9s';

// --- time budget -------------------------------------------------------------------------------------
// OwnTV gives a scraper 30 s per title. Every request is refused once the budget is spent and is capped by
// what is left of it, so a slow site costs its own time, never the whole answer (and never a hang).
var __budgetEnd = 0;
function startBudget(ms) { __budgetEnd = Date.now() + ms; }
function timeLeft() { return __budgetEnd ? __budgetEnd - Date.now() : 1e9; }

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

// fetch with a per-request timeout (the host's `timeoutMs`, plus a race for hosts that ignore it)
async function http(url, opt) {
  opt = opt || {};
  var left = timeLeft();
  if (left < 600) throw new Error('time budget used');
  var timeout = Math.min(opt.timeout || 8000, left - 100);
  var headers = { 'User-Agent': UA };
  if (opt.headers) for (var k in opt.headers) headers[k] = opt.headers[k];
  var init = { method: opt.method || 'GET', headers: headers, redirect: opt.redirect || 'follow', timeoutMs: Math.max(500, Math.floor(timeout)) };
  if (opt.body !== undefined) init.body = opt.body;
  var timer;
  var timed = new Promise(function (resolve, reject) { timer = setTimeout(function () { reject(new Error('timeout ' + url.slice(0, 80))); }, timeout + 400); });
  try {
    return await Promise.race([fetch(url, init), timed]);
  } finally {
    clearTimeout(timer);
  }
}

// the body as text, or null when the request fails or the site answers an error (a title that is simply not there)
async function getText(url, opt) {
  try {
    var r = await http(url, opt);
    if (!r.ok) return null;
    var t = await r.text();
    return t && t.length ? t : null;
  } catch (e) {
    return null;
  }
}

async function getJson(url, opt) {
  var t = await getText(url, opt);
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { return null; }
}

// run fn over items, at most `limit` at a time; a failing item gives null
async function mapLimit(items, limit, fn) {
  var out = new Array(items.length);
  var next = 0;
  async function worker() {
    for (;;) {
      var i = next++;
      if (i >= items.length) return;
      try { out[i] = await fn(items[i], i); } catch (e) { out[i] = null; }
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(limit, items.length); w++) workers.push(worker());
  await Promise.all(workers);
  return out;
}

// the first non-null answer of fn over items; null when none answers. With `staggerMs` item i only starts
// after i * staggerMs (and not at all once an answer is in), so mirrors are tried in order without waiting
// for each one to fail, yet a healthy first mirror costs one request, not five.
function firstOk(items, fn, staggerMs) {
  return new Promise(function (resolve) {
    var pending = items.length;
    var done = false;
    if (!pending) return resolve(null);
    items.forEach(function (item, i) {
      (staggerMs && i ? sleep(i * staggerMs) : Promise.resolve()).then(function () {
        if (done) return null;
        return fn(item);
      }).then(function (v) {
        if (v && !done) { done = true; resolve(v); }
      }, function () {}).then(function () {
        if (--pending === 0) resolve(null);
      });
    });
  });
}

// --- text helpers ----------------------------------------------------------------------------------------
function slugify(title) {
  return String(title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
}

function decodeEntities(s) {
  return String(s || '').replace(/&amp;|&#0?38;|&#x26;/gi, '&').replace(/&quot;|&#0?34;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function absUrl(u, base) {
  if (!u) return u;
  u = decodeEntities(String(u)).trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.indexOf('//') === 0) return 'https:' + u;
  try { return new URL(u, base).toString(); } catch (e) { return u; }
}

function hostOf(u) {
  var m = /^https?:\/\/([^\/?#:]+)/i.exec(String(u || ''));
  return m ? m[1].toLowerCase() : '';
}

function originOf(u) {
  var m = /^(https?:\/\/[^\/?#]+)/i.exec(String(u || ''));
  return m ? m[1] : '';
}

// a video's size -> the usual name (a 1920x872 film is 1080p: wide films are cropped, not smaller)
function qualityFromSize(w, h) {
  if (w >= 3400 || h >= 1900) return '2160p';
  if (w >= 2400 || h >= 1300) return '1440p';
  if (w >= 1800 || h >= 1000) return '1080p';
  if (w >= 1200 || h >= 650) return '720p';
  if (w >= 800 || h >= 440) return '480p';
  return '360p';
}

function qualityOf(text) {
  var t = String(text || '').toLowerCase();
  if (/2160|4k|uhd/.test(t)) return '2160p';
  if (/1440/.test(t)) return '1440p';
  if (/1080|fhd|full/.test(t)) return '1080p';
  if (/720|\bhd\b/.test(t)) return '720p';
  if (/480|\bsd\b/.test(t)) return '480p';
  if (/360/.test(t)) return '360p';
  return 'Auto';
}

// --- TMDB: the titles a Spanish site may know a film by (answered by the host; it adds the key) --------
async function tmdbTitles(tmdbId, mediaType) {
  var kind = mediaType === 'tv' ? 'tv' : 'movie';
  async function one(lang) {
    var j = await getJson('https://api.themoviedb.org/3/' + kind + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=' + lang);
    return j && j.success !== false ? j : null;
  }
  var all = await Promise.all([one('es-MX'), one('es-ES'), one('en-US')]);
  var es = all[0], eses = all[1], en = all[2];
  var nameKey = kind === 'tv' ? 'name' : 'title';
  var origKey = kind === 'tv' ? 'original_name' : 'original_title';
  var dateKey = kind === 'tv' ? 'first_air_date' : 'release_date';
  var date = String((es && es[dateKey]) || (en && en[dateKey]) || (eses && eses[dateKey]) || '');
  var titles = [];
  [es, eses, en].forEach(function (d) {
    if (!d) return;
    [d[nameKey], d[origKey]].forEach(function (t) {
      t = String(t || '').trim();
      if (t && titles.indexOf(t) < 0) titles.push(t);
    });
  });
  return {
    id: tmdbId,
    latino: String((es && es[nameKey]) || ''),
    castellano: String((eses && eses[nameKey]) || ''),
    english: String((en && en[nameKey]) || ''),
    titles: titles,
    year: /^\d{4}/.test(date) ? parseInt(date.slice(0, 4), 10) : null,
  };
}

function episodeCode(season, episode) {
  return 'S' + String(season).padStart(2, '0') + 'E' + String(episode).padStart(2, '0');
}

// --- Dean Edwards' p.a.c.k.e.r. (what StreamWish / VidHide / Fastream hide their player setup in) ---------
function unpackPacked(src) {
  var m = /eval\(function\(p,a,c,k,e,[a-z]\)\{[\s\S]*?\}\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/.exec(src);
  if (!m) return null;
  var payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  var a = parseInt(m[2], 10);
  var c = parseInt(m[3], 10);
  var k = m[4].split('|');
  function e(n) { return (n < a ? '' : e(Math.floor(n / a))) + ((n = n % a) > 35 ? String.fromCharCode(n + 29) : n.toString(36)); }
  var d = {};
  while (c--) d[e(c)] = k[c] || e(c);
  return payload.replace(/\b\w+\b/g, function (w) { return Object.prototype.hasOwnProperty.call(d, w) ? d[w] : w; });
}

// every player script a page offers, unpacked or as written
function playerScripts(html) {
  var out = [html];
  var re = /eval\(function\(p,a,c,k,e,[a-z]\)[\s\S]*?\.split\('\|'\)[^<]*?\)\)/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var u = null;
    try { u = unpackPacked(m[0]); } catch (e) { u = null; }
    if (u) out.push(u);
  }
  return out;
}

// the stream address inside a JW-player style page (StreamWish, VidHide, Fastream, LuluStream...)
function jwStreamUrl(html, pageUrl) {
  var scripts = playerScripts(html);
  var res = [
    /"hls[234]"\s*:\s*"([^"]+)"/i,
    /hls[234]?\s*:\s*["']([^"']+)["']/i,
    /sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i,
    /file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i,
    /["'](https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)["']/i,
  ];
  for (var s = scripts.length - 1; s >= 0; s--) {
    for (var r = 0; r < res.length; r++) {
      var m = res[r].exec(scripts[s]);
      if (m) {
        var u = m[1].replace(/\\\//g, '/').replace(/\\/g, '');
        if (/^https?:\/\/|^\//.test(u)) return absUrl(u, pageUrl);
      }
    }
  }
  return null;
}

// --- hoster resolvers: embed page -> a playable address + the headers it needs -----------------------------
function pickHoster(url) {
  var h = hostOf(url);
  if (!h) return '';
  var families = [
    ['streamwish', /hlswish|streamwish|hglink|hgplay|hglamioz|audinifer|embedwish|awish|dwish|strwish|wishembed|wishfast|hanerix|vibuxer|swhoi|swdyu|jwplayerhls/],
    ['vidhide', /vidhide|minochinos|vadisov|vaiditv|amusemre|callistanise|vhaudm|mdfury|dintezuvio|acek-cdn|vedonm|masukestin|filelions|vidoza|supervideo|streamhide|dhtpre|peytonepre|motvy55|morencius|earnvid/],
    ['voe', /voe\.sx|voe-sx|voex\.sx|marissashare|cloudwindow|eugenemakedraw|jilliandescribecompany|lauradaydo|bradleyviewdoctor|robertplacespay/],
    ['dood', /dood|ds2video|ds2play|d000d|d0000d|d0o0d|do0od|vidply|do7go|all3do|doply|dsvplay|playmogo|myvidplay/],
    ['lulu', /lulustream|luluvdo|luluvids|lulupuv|pondy/],
    ['goodstream', /goodstream|gs\.one/],
    ['fastream', /fastream/],
    ['dropcdn', /dropcdn|dropload|dr0pstream/],
    ['okru', /ok\.ru|okru/],
    ['pixeldrain', /pixeldrain/],
  ];
  for (var i = 0; i < families.length; i++) if (families[i][1].test(h)) return families[i][0];
  return '';
}

// mirrors that are known to serve what a dead domain used to (the sites themselves rotate domains)
var MIRRORS = {
  streamwish: ['hanerix.com', 'embedwish.com', 'vibuxer.com', 'hgplaycdn.com', 'awish.pro', 'strwish.com'],
  vidhide: ['callistanise.com', 'minochinos.com', 'vidhidepro.com', 'vidhidevip.com'],
};

function idFromEmbed(url) {
  var path = String(url).split('?')[0].replace(/[#].*$/, '').replace(/\/+$/, '');
  var last = path.split('/').pop() || '';
  return last.replace(/\.html$/i, '').replace(/^embed-/i, '');
}

async function resolveJwPage(url, referer, server) {
  var html = await getText(url, { headers: { Referer: referer || url }, timeout: 6000 });
  if (!html) return null;
  var u = jwStreamUrl(html, url);
  if (!u) return null;
  var o = originOf(url);
  return { url: u, server: server, headers: { 'User-Agent': UA, Referer: url, Origin: o } };
}

async function resolveStreamwish(url) {
  var id = idFromEmbed(url);
  var seen = {};
  var pages = [];
  // the working mirrors first; the address the site gave comes last (streamwish.to / hglink.to answer a
  // "Loading..." stub that holds no player), after a rewrite by the site's own domain map it is a mirror anyway
  MIRRORS.streamwish.forEach(function (m) { pages.push('https://' + m + '/e/' + id); });
  if (id) pages.push(url);
  pages = pages.filter(function (p) { if (seen[p]) return false; seen[p] = true; return true; }).slice(0, 5);
  return firstOk(pages, function (p) { return resolveJwPage(p, p, 'StreamWish'); }, 800);
}

async function resolveVidhide(url) {
  var id = idFromEmbed(url);
  var pages = [url];
  if (id) MIRRORS.vidhide.forEach(function (m) { var p = 'https://' + m + '/v/' + id; if (pages.indexOf(p) < 0) pages.push(p); });
  return firstOk(pages.slice(0, 4), function (p) { return resolveJwPage(p, p, 'VidHide'); }, 1500);
}

function rot13(s) {
  return s.replace(/[a-zA-Z]/g, function (c) {
    var code = c.charCodeAt(0);
    var limit = c.toUpperCase() === c ? 90 : 122;
    var shifted = code + 13;
    return String.fromCharCode(limit >= shifted ? shifted : shifted - 26);
  });
}

function b64decode(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  var bin = atob(s);
  try {
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return bin;
  }
}

async function resolveVoe(url, depth) {
  depth = depth || 0;
  var html = await getText(url, { headers: { Referer: url }, timeout: 6000 });
  if (!html) return null;
  if (html.indexOf('window.location.href') >= 0 && html.length < 2000 && depth < 2) {
    var redirect = /window\.location\.href\s*=\s*['"]([^'"]+)['"]/i.exec(html);
    if (redirect) return resolveVoe(absUrl(redirect[1], url), depth + 1);
  }
  var found = null;
  var j = /<script type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (j) {
    try {
      var enc = j[1].trim();
      if (enc.charAt(0) === '[') enc = JSON.parse(enc)[0];
      var s = rot13(String(enc));
      ['@$', '^^', '~@', '%?', '*~', '!!', '#&'].forEach(function (n) { s = s.split(n).join(''); });
      var first = b64decode(s);
      var shifted = '';
      for (var i = 0; i < first.length; i++) shifted += String.fromCharCode(first.charCodeAt(i) - 3);
      var back = b64decode(shifted.split('').reverse().join(''));
      var data = JSON.parse(back);
      if (data && data.source) found = String(data.source);
    } catch (e) { found = null; }
  }
  if (!found) {
    var m = /["'](https?:\/\/[^"']+?\.m3u8[^"']*?)["']/i.exec(html);
    if (m) found = m[1];
  }
  if (!found) return null;
  return { url: found, server: 'VOE', headers: { 'User-Agent': UA, Referer: url } };
}

async function resolveDood(url) {
  var embed = /\/e\//.test(url) ? url : url.replace(/\/(d|f)\//, '/e/');
  var html = await getText(embed, { headers: { Referer: embed }, timeout: 6000 });
  if (!html) return null;
  var m = /\$\.get\('(\/pass_md5\/[\w-]+)\/([\w-]+)'/.exec(html);
  if (!m) return null;
  var origin = originOf(embed);
  var base = await getText(origin + m[1] + '/' + m[2], { headers: { Referer: embed }, timeout: 6000 });
  if (!base) return null;
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var rnd = '';
  for (var i = 0; i < 10; i++) rnd += chars.charAt(Math.floor(Math.random() * chars.length));
  return { url: base.trim() + rnd + '?token=' + m[2] + '&expiry=' + Date.now(), server: 'DoodStream', headers: { 'User-Agent': UA, Referer: origin + '/' } };
}

async function resolveGoodstream(url) {
  var html = await getText(url, { headers: { Referer: 'https://goodstream.one/' }, timeout: 6000 });
  if (!html) return null;
  var m = /file:\s*"([^"]+)"/.exec(html);
  if (!m) return null;
  return { url: m[1], server: 'GoodStream', headers: { 'User-Agent': UA, Referer: url, Origin: 'https://goodstream.one' } };
}

async function resolveOkru(url) {
  var html = await getText(url, { headers: { Referer: url }, timeout: 6000 });
  if (!html) return null;
  var m = /data-options="([^"]*)"/.exec(html);
  if (!m) return null;
  try {
    var opt = JSON.parse(decodeEntities(m[1]));
    var meta = opt.flashvars && opt.flashvars.metadata;
    if (typeof meta === 'string') meta = JSON.parse(meta);
    if (!meta) return null;
    var hls = meta.hlsMasterPlaylistUrl || meta.hlsManifestUrl || meta.ondemandHls;
    if (hls) return { url: hls, server: 'OK.ru', headers: { 'User-Agent': UA, Referer: url } };
    var names = { mobile: '144p', lowest: '240p', low: '360p', sd: '480p', hd: '720p', full: '1080p', quad: '1440p', ultra: '2160p' };
    var videos = (meta.videos || []).slice().reverse();
    for (var i = 0; i < videos.length; i++) {
      if (videos[i].url && /^http/.test(videos[i].url)) return { url: videos[i].url, server: 'OK.ru', quality: names[videos[i].name] || '', headers: { 'User-Agent': UA, Referer: url } };
    }
  } catch (e) { return null; }
  return null;
}

async function resolvePixeldrain(url) {
  var m = /\/(?:u|l|api\/file)\/([a-zA-Z0-9]+)/.exec(url);
  if (!m) return null;
  return { url: 'https://pixeldrain.com/api/file/' + m[1] + '?download=1', server: 'Pixeldrain', headers: { 'User-Agent': UA, Referer: 'https://pixeldrain.com/' } };
}

async function resolveDropcdn(url) {
  var id = idFromEmbed(url.replace('/d/', '/').replace('/e/', '/'));
  var embed = 'https://dr0pstream.com/e/' + id;
  var html = await getText(embed, { headers: { Referer: 'https://dr0pstream.com/', Origin: 'https://dr0pstream.com', 'X-Requested-With': 'XMLHttpRequest' }, timeout: 6000 });
  if (!html) return null;
  var all = html.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/g) || [];
  if (!all.length) return null;
  var best = all.filter(function (u) { return u.indexOf('master.m3u8') >= 0 && u.indexOf('?t=') >= 0; })[0]
    || all.filter(function (u) { return u.indexOf('master.m3u8') >= 0; })[0] || all[0];
  return { url: best, server: 'DropCDN', headers: { 'User-Agent': UA, Referer: 'https://dr0pstream.com/', Origin: 'https://dr0pstream.com' } };
}

// Resolves one embed address. Null for a hoster nobody here can open without a browser (StreamTape, Netu...).
async function resolveHoster(url, hint) {
  url = String(url || '');
  var family = pickHoster(url);
  if (!family && hint) {
    // a site that names its server ("vidhide") for a domain nobody here knows yet
    var h = String(hint).toLowerCase();
    family = /streamwish|hglink|vibuxer/.test(h) ? 'streamwish' : /vidhide|filelions|callistanise/.test(h) ? 'vidhide' : /voe/.test(h) ? 'voe' : /dood/.test(h) ? 'dood' : /lulu/.test(h) ? 'lulu' : /fastream/.test(h) ? 'fastream' : '';
  }
  var r = null;
  try {
    if (family === 'streamwish') r = await resolveStreamwish(url);
    else if (family === 'vidhide') r = await resolveVidhide(url);
    else if (family === 'voe') r = await resolveVoe(url);
    else if (family === 'dood') r = await resolveDood(url);
    else if (family === 'goodstream') r = await resolveGoodstream(url);
    else if (family === 'fastream') r = await resolveJwPage(url, url, 'Fastream');
    else if (family === 'lulu') r = await resolveJwPage(url, url, 'LuluStream');
    else if (family === 'dropcdn') r = await resolveDropcdn(url);
    else if (family === 'okru') r = await resolveOkru(url);
    else if (family === 'pixeldrain') r = await resolvePixeldrain(url);
  } catch (e) {
    r = null;
  }
  if (r && r.url) r.url = String(r.url).replace(/\\\//g, '/');
  return r && /^https?:\/\//i.test(r.url) ? r : null;
}

// --- the pre-check (lolapp: a short m3u8 probe so dead servers are dropped) -----------------------------------
// One ranged request. A playlist must start with #EXTM3U (its best RESOLUTION becomes the quality, and the
// answer says hls, so the link goes out with type 'hls': OwnTV then opens it as HLS even when its address does
// not end in .m3u8); anything else must be a video answer (200/206, not an HTML page), so a DoodStream file or a
// Pixeldrain download passes without being downloaded.
async function probeStream(s) {
  try {
    var h = {};
    for (var k in s.headers) h[k] = s.headers[k];
    h.Range = 'bytes=0-65535';
    var res = await http(s.url, { headers: h, timeout: 5000 });
    if (res.status !== 200 && res.status !== 206) return { ok: false };
    var type = String((res.headers && res.headers.get && res.headers.get('content-type')) || '').toLowerCase();
    if (type.indexOf('text/html') >= 0) return { ok: false };
    var text = '';
    try { text = await res.text(); } catch (e) { text = ''; }
    if (text.indexOf('#EXTM3U') >= 0) {
      var bestH = 0;
      var bestW = 0;
      var re = /RESOLUTION=(\d+)x(\d+)/g;
      var m;
      while ((m = re.exec(text)) !== null) {
        var w = parseInt(m[1], 10);
        var hh = parseInt(m[2], 10);
        if (hh > bestH) { bestH = hh; bestW = w; }
      }
      return { ok: true, hls: true, quality: bestH ? qualityFromSize(bestW, bestH) : '' };
    }
    if (/\.(?:m3u8|txt)(\?|#|$)/i.test(s.url) && /^\s*</.test(text)) return { ok: false };
    var isVideo = type.indexOf('video/') >= 0 || type.indexOf('octet-stream') >= 0 || /\.(?:mp4|mkv|webm)(\?|#|$)/i.test(s.url);
    return { ok: isVideo || (res.status === 206) };
  } catch (e) {
    return { ok: false };
  }
}

// resolved servers -> checked links, in the order given: [{lang, server, embed, source}] -> streams
// `title` is the film (or episode) the person asked for.
async function linksFrom(entries, title, opt) {
  opt = opt || {};
  var results = await mapLimit(entries, opt.limit || 5, async function (e) {
    var r = e.resolved || await resolveHoster(e.embed, e.hint);
    if (!r) return null;
    var p = await probeStream(r);
    if (!p.ok) return null;
    var quality = p.quality || r.quality || e.quality || 'Auto';
    var link = {
      name: e.lang + ' \u00b7 ' + (e.source ? e.source + ' ' : '') + r.server,
      title: title + ' - ' + e.lang,
      url: r.url,
      quality: quality,
      headers: r.headers,
      provider: opt.provider || 'owntv-pack',
    };
    if (p.hls) link.type = 'hls';
    return link;
  });
  var seen = {};
  return results.filter(function (s) {
    if (!s || seen[s.url]) return false;
    seen[s.url] = true;
    return true;
  });
}

// links a provider already has in hand ({name, title, url, headers, quality}) -> the ones that answer, quality
// taken from the playlist when it states one
async function checkLinks(list, limit) {
  var seen = {};
  var unique = list.filter(function (s) {
    if (!s || !s.url || seen[s.url]) return false;
    seen[s.url] = true;
    return true;
  });
  var out = await mapLimit(unique, limit || 6, async function (s) {
    var p = await probeStream({ url: s.url, headers: s.headers || { 'User-Agent': UA } });
    if (!p.ok) return null;
    if (p.quality && (!s.quality || s.quality === 'Auto')) s.quality = p.quality;
    if (p.hls) s.type = 'hls';
    if (!s.quality) s.quality = 'Auto';
    if (!s.headers) s.headers = { 'User-Agent': UA };
    return s;
  });
  return out.filter(Boolean);
}

// a film's or an episode's name for the link's title: "Oppenheimer (2023)" / "Breaking Bad S01E01"
function labelFor(t, tv, season, episode) {
  var name = t.english || t.latino || (t.titles && t.titles[0]) || '';
  return tv ? name + ' ' + episodeCode(season || 1, episode || 1) : name + (t.year ? ' (' + t.year + ')' : '');
}

// POST helpers: JSON in, JSON out
async function postJson(url, body, headers, timeout) {
  try {
    var h = { 'Content-Type': 'application/json' };
    if (headers) for (var k in headers) h[k] = headers[k];
    var r = await http(url, { method: 'POST', headers: h, body: JSON.stringify(body), timeout: timeout || 8000 });
    if (!r.ok) return null;
    return JSON.parse(await r.text());
  } catch (e) {
    return null;
  }
}
// ---- end _lib.js ----
// ---- begin _next_site.js ----
// ---- the Next.js "cuevana" family (Cuevana, PoseidonHD): title page -> __NEXT_DATA__ -> player.php -> hoster ----
// Flow after lolapp's CuevanaService / PoseidonService (TMDB titles -> slug candidates -> the page's JSON
// -> each `player.php` link -> the hoster's embed address -> the stream).
// A site is described by { name, base, referer, pages(t, tv, season, episode) -> [url], domainMap }.

function extractNextData(html) {
  var m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try {
    var d = JSON.parse(m[1]);
    return d && d.props && d.props.pageProps ? d.props.pageProps : null;
  } catch (e) {
    return null;
  }
}

// the video lists of a page that really is this film / episode (a wrong film is worse than none)
function pageVideos(pp, tmdbId, tv, season, episode) {
  if (!pp) return null;
  if (!tv) {
    var movie = pp.thisMovie;
    if (!movie || !movie.videos) return null;
    if (movie.TMDbId && String(movie.TMDbId) !== String(tmdbId)) return null;
    return movie.videos;
  }
  var ep = pp.episode || pp.thisEpisode;
  if (!ep || !ep.videos) return null;
  if (pp.serie && pp.serie.TMDbId && String(pp.serie.TMDbId) !== String(tmdbId)) return null;
  if (ep.number !== undefined && parseInt(ep.number, 10) !== parseInt(episode, 10)) return null;
  return ep.videos;
}

// `player.php?h=...` -> the hoster address the page puts in `var url = '...'`. The same `h` token opens on
// the sister sites' player (site.playerFallbacks), which keeps a site usable while its own player is down.
async function playerTarget(site, playerUrl) {
  var urls = [playerUrl];
  (site.playerFallbacks || []).forEach(function (origin) {
    var o = originOf(playerUrl);
    if (o && o !== origin) urls.push(playerUrl.replace(o, origin));
  });
  return firstOk(urls, async function (u) {
    var html = await getText(u, { headers: { Referer: site.base + '/' }, timeout: 7000 });
    if (!html) return null;
    var m = /var\s+url\s*=\s*'([^']+)'/.exec(html) || /var\s+url\s*=\s*"([^"]+)"/.exec(html)
      || /window\.location\.href\s*=\s*['"]([^'"]+)['"]/.exec(html)
      || /(?:file|src|source)\s*[:=]\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i.exec(html);
    return m ? absUrl(m[1], u) : null;
  }, 1500);
}

// a dead hoster domain rewritten to the one that serves it now (lolapp's domain maps), original kept as a fallback
function hosterCandidates(site, url) {
  var out = [];
  var h = hostOf(url);
  var map = site.domainMap || {};
  for (var from in map) {
    if (h.indexOf(from) >= 0) out.push(url.replace(h, h.replace(from, map[from])));
  }
  out.push(url);
  return out;
}

// the site's `cyberlocker` names whose pages a resolver here can open (StreamTape, Netu... need a browser)
var LOCKERS_WE_OPEN = /streamwish|vidhide|filelions|voe|dood|lulu|goodstream|fastream|dropload|okru/i;

var NEXT_LANGS = [['latino', LANG_LATINO], ['spanish', LANG_CASTELLANO], ['english', LANG_INGLES]];

async function nextSiteStreams(site, tmdbId, mediaType, season, episode) {
  startBudget(24000);
  try {
    var tv = mediaType === 'tv';
    var t = await tmdbTitles(tmdbId, mediaType);
    if (!t.titles.length) return [];
    var urls = site.pages(t, tv, season, episode).slice(0, 8);
    var headers = { Referer: site.base + '/', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' };
    var videos = await firstOk(urls, async function (u) {
      var html = await getText(u, { headers: headers, timeout: 9000 });
      if (!html || html.indexOf('__NEXT_DATA__') < 0) return null;
      return pageVideos(extractNextData(html), tmdbId, tv, season, episode);
    });
    if (!videos) return [];

    var jobs = [];
    NEXT_LANGS.forEach(function (pair) {
      (videos[pair[0]] || []).forEach(function (v) {
        if (v && v.result && LOCKERS_WE_OPEN.test(String(v.cyberlocker || ''))) {
          jobs.push({ lang: pair[1], player: v.result, locker: v.cyberlocker, quality: v.quality });
        }
      });
    });
    // StreamWish first (its mirrors are the most reliable), then the rest in the site's own order
    var entries = await mapLimit(jobs, 6, async function (j) {
      var target = await playerTarget(site, j.player);
      if (!target) return null;
      var resolved = null;
      var cands = hosterCandidates(site, target);
      for (var i = 0; i < cands.length && !resolved; i++) resolved = await resolveHoster(cands[i]);
      if (!resolved) return null;
      var p = await probeStream(resolved);
      if (!p.ok) return null;
      return { lang: j.lang, resolved: resolved, quality: p.quality || qualityOf(j.quality), hls: !!p.hls, source: '' };
    });
    var title = (t.latino || t.english || t.titles[0]) + (tv ? ' ' + episodeCode(season, episode) : t.year ? ' (' + t.year + ')' : '');
    var out = [];
    var seen = {};
    entries.forEach(function (e) {
      if (!e || seen[e.resolved.url]) return;
      seen[e.resolved.url] = true;
      out.push({
        name: e.lang + ' · ' + e.resolved.server,
        title: title + ' - ' + e.lang,
        url: e.resolved.url,
        quality: e.quality,
        headers: e.resolved.headers,
        type: e.hls ? 'hls' : undefined,
        provider: site.name.toLowerCase(),
      });
    });
    return out;
  } catch (err) {
    console.error('[' + site.name + '] ' + (err && err.message ? err.message : err));
    return [];
  }
}
// ---- end _next_site.js ----

async function getStreams(tmdbId, mediaType, season, episode) {
  return nextSiteStreams(SITE, tmdbId, mediaType, season, episode);
}

module.exports = { getStreams };
