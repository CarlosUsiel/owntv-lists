// copied from https://github.com/ahmedelkassrawy/nuvio-providers@6ffcfa8f0e21 (providers/vadapav.js), no licence stated by the repository; the original file follows unchanged.
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/_lib/http.js
var require_http = __commonJS({
  "src/_lib/http.js"(exports2, module2) {
    function timeout(ms) {
      return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
    }
    function fetchT2(url, opts, ms) {
      return Promise.race([fetch(url, opts), timeout(ms || 8e3)]);
    }
    function fetchTextT(url, opts, ms) {
      const work = (() => __async(this, null, function* () {
        const res = yield fetch(url, opts);
        const text = yield res.text();
        return { ok: res.ok, status: res.status, text, url: res.url };
      }))();
      return Promise.race([work, timeout(ms || 8e3)]);
    }
    module2.exports = { fetchT: fetchT2, fetchTextT };
  }
});

// src/_lib/tmdb.js
var require_tmdb = __commonJS({
  "src/_lib/tmdb.js"(exports2, module2) {
    var TMDB_API_KEY = "";
    var DIRECT = "https://api.themoviedb.org/3";
    var PROXY = "https://db.speedracelight.com/3";
    var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    var { fetchT: fetchT2 } = require_http();
    var _cache = /* @__PURE__ */ new Map();
    function fetchMeta(base, kind, tmdbId, withKey) {
      return __async(this, null, function* () {
        const key = withKey ? `&api_key=${TMDB_API_KEY}` : "";
        const url = `${base}/${kind}/${tmdbId}?append_to_response=external_ids${key}`;
        const res = yield fetchT2(url, { headers: { "User-Agent": UA, Accept: "application/json" } }, 6e3);
        if (!res.ok) return null;
        return res.json();
      });
    }
    function resolveMeta2(tmdbId, mediaType) {
      return __async(this, null, function* () {
        const kind = mediaType === "tv" ? "tv" : "movie";
        const ck = `${kind}:${tmdbId}`;
        if (_cache.has(ck)) return _cache.get(ck);
        let j = null;
        try {
          j = yield fetchMeta(DIRECT, kind, tmdbId, true);
        } catch (e) {
        }
        if (!j) {
          try {
            j = yield fetchMeta(PROXY, kind, tmdbId, false);
          } catch (e) {
          }
        }
        if (!j) return null;
        const title = kind === "tv" ? j.name || j.original_name : j.title || j.original_title;
        const dateStr = kind === "tv" ? j.first_air_date : j.release_date;
        const year = dateStr ? parseInt(String(dateStr).slice(0, 4), 10) : null;
        const imdbId = j.external_ids && j.external_ids.imdb_id || j.imdb_id || null;
        const meta = { title, year, imdbId };
        _cache.set(ck, meta);
        return meta;
      });
    }
    module2.exports = { resolveMeta: resolveMeta2, TMDB_API_KEY, DIRECT, UA };
  }
});

// src/_lib/dedup.js
var require_dedup = __commonJS({
  "src/_lib/dedup.js"(exports2, module2) {
    function dedupByUrl2(streams) {
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const s of streams) {
        if (!s || !s.url || seen.has(s.url)) continue;
        seen.add(s.url);
        out.push(s);
      }
      return out;
    }
    var RANK = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "CAM": 1 };
    function sortByQuality2(streams) {
      return streams.slice().sort((a, b) => (RANK[b.quality] || 0) - (RANK[a.quality] || 0));
    }
    function parseQuality2(s) {
      const t = String(s || "");
      if (/2160|\b4k\b|uhd/i.test(t)) return "2160p";
      if (/1080/.test(t)) return "1080p";
      if (/720/.test(t)) return "720p";
      if (/480/.test(t)) return "480p";
      if (/\bcam\b/i.test(t)) return "CAM";
      return "Auto";
    }
    module2.exports = { dedupByUrl: dedupByUrl2, sortByQuality: sortByQuality2, parseQuality: parseQuality2 };
  }
});

// src/vadapav.js
var { resolveMeta } = require_tmdb();
var { dedupByUrl, sortByQuality, parseQuality } = require_dedup();
var { fetchT } = require_http();
var BASE = "https://stremio.vadapav.mov";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*"
};
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    try {
      const isTv = mediaType === "tv";
      const meta = yield resolveMeta(tmdbId, mediaType);
      const ids = [];
      if (meta && meta.imdbId && meta.imdbId.startsWith("tt")) ids.push(meta.imdbId);
      ids.push(`tmdb:${tmdbId}`);
      for (const id of ids) {
        const ep = isTv ? `${BASE}/stream/series/${id}:${season || 1}:${episode || 1}.json` : `${BASE}/stream/movie/${id}.json`;
        try {
          const res = yield fetchT(ep, { headers: HEADERS }, 1e4);
          if (!res.ok) continue;
          const data = yield res.json();
          const streams = data && data.streams;
          if (!Array.isArray(streams)) continue;
          for (const it of streams) {
            const url = it && it.url;
            if (!url || !String(url).startsWith("http") || seen.has(url)) continue;
            seen.add(url);
            const label = it.title || it.name || "vadapav.mov";
            out.push({ name: it.name || "vadapav.mov", title: label, url, quality: parseQuality(label), headers: HEADERS });
          }
          if (streams.length) break;
        } catch (e) {
        }
      }
    } catch (e) {
    }
    return sortByQuality(dedupByUrl(out));
  });
}
module.exports = { getStreams };
