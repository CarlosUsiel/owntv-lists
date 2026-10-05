// copied from https://github.com/ahmedelkassrawy/nuvio-providers@6ffcfa8f0e21 (providers/movy.js), no licence stated by the repository; the original file follows unchanged.
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
    var UA2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    var { fetchT: fetchT2 } = require_http();
    var _cache = /* @__PURE__ */ new Map();
    function fetchMeta(base, kind, tmdbId, withKey) {
      return __async(this, null, function* () {
        const key = withKey ? `&api_key=${TMDB_API_KEY}` : "";
        const url = `${base}/${kind}/${tmdbId}?append_to_response=external_ids${key}`;
        const res = yield fetchT2(url, { headers: { "User-Agent": UA2, Accept: "application/json" } }, 6e3);
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
    module2.exports = { resolveMeta: resolveMeta2, TMDB_API_KEY, DIRECT, UA: UA2 };
  }
});

// src/_lib/crypto.js
var require_crypto = __commonJS({
  "src/_lib/crypto.js"(exports2, module2) {
    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    function base64Decode2(str) {
      const clean = String(str).replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
      const bytes = [];
      for (let i = 0; i < clean.length; i += 4) {
        const n0 = B64.indexOf(clean[i]);
        const n1 = B64.indexOf(clean[i + 1]);
        const n2 = clean[i + 2] ? B64.indexOf(clean[i + 2]) : -1;
        const n3 = clean[i + 3] ? B64.indexOf(clean[i + 3]) : -1;
        bytes.push(n0 << 2 | n1 >> 4);
        if (n2 >= 0) bytes.push((n1 & 15) << 4 | n2 >> 2);
        if (n3 >= 0) bytes.push((n2 & 3) << 6 | n3);
      }
      return bytes;
    }
    function base64DecodeStr(str) {
      return utf8Decode2(base64Decode2(str));
    }
    function base64Encode(input) {
      const bytes = typeof input === "string" ? input.split("").map((c) => c.charCodeAt(0) & 255) : input;
      let out = "";
      for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i];
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        out += B64[b0 >> 2];
        out += B64[(b0 & 3) << 4 | b1 >> 4];
        out += i + 1 < bytes.length ? B64[(b1 & 15) << 2 | b2 >> 6] : "=";
        out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
      }
      return out;
    }
    function base64UrlEncode(input) {
      return base64Encode(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function rot13(str) {
      return String(str).replace(/[a-zA-Z]/g, (c) => {
        const base = c <= "Z" ? 65 : 97;
        return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
      });
    }
    function utf8Decode2(bytes) {
      let out = "";
      let i = 0;
      while (i < bytes.length) {
        const b = bytes[i++];
        if (b < 128) {
          out += String.fromCharCode(b);
        } else if (b >= 192 && b < 224) {
          out += String.fromCharCode((b & 31) << 6 | bytes[i++] & 63);
        } else if (b >= 224 && b < 240) {
          out += String.fromCharCode((b & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63);
        } else {
          let cp = (b & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
          cp -= 65536;
          out += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
        }
      }
      return out;
    }
    module2.exports = { base64Decode: base64Decode2, base64DecodeStr, base64Encode, base64UrlEncode, rot13, utf8Decode: utf8Decode2 };
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

// src/movy.js
var { resolveMeta } = require_tmdb();
var { base64Decode, utf8Decode } = require_crypto();
var { dedupByUrl, sortByQuality, parseQuality } = require_dedup();
var { fetchT } = require_http();
var API = "https://api.wecollege.net";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS = { "User-Agent": UA, Referer: "https://www.movy.bz/", Origin: "https://www.movy.bz" };
var MAGIC = [109, 118, 109, 49];
var SERVERS = [
  { endpoint: "miami", name: "Miami" },
  { endpoint: "seattle", name: "Seattle" },
  { endpoint: "denver", name: "Denver" },
  { endpoint: "chicago", name: "Chicago" },
  { endpoint: "dallas", name: "Dallas" },
  { endpoint: "atlanta", name: "Atlanta" },
  { endpoint: "houston", name: "Houston" },
  { endpoint: "austin", name: "Austin" },
  { endpoint: "boston", name: "Boston" },
  { endpoint: "munich", name: "Munich", extra: "language=german" },
  { endpoint: "berlin", name: "Berlin" },
  { endpoint: "paris", name: "Paris" },
  { endpoint: "delhi", name: "Delhi" },
  { endpoint: "cancun", name: "Cancun" }
];
var u = (x) => x >>> 0;
function _l(e) {
  let v = u(e);
  v = u(v ^ v >>> 16);
  v = u(Math.imul(v, 2246822507));
  v = u(v ^ v >>> 13);
  v = u(Math.imul(v, 3266489909));
  return u(v ^ v >>> 16);
}
function _u(e, t) {
  const s = t & 31;
  if (s === 0) return u(e);
  return u(u(e << s) | u(e) >>> 32 - s);
}
function _fnv1a(str) {
  let t = u(2166136261);
  for (let i = 0; i < str.length; i++) t = u(Math.imul(u(t ^ str.charCodeAt(i)), 16777619));
  return _l(t);
}
function initState(seed, tmdbId) {
  const s = new Array(61).fill(0);
  const isSet = new Array(61).fill(false);
  let r = _l(u(_fnv1a(seed) ^ _l(u(u(tmdbId) ^ 2654435769))));
  for (let e = 0; e < 8; e++) {
    const t = r % 61;
    r = _u(u(r + 2654435769), 7 + (7 & e));
    s[t] = u(r ^ _l(r));
    isSet[t] = true;
    r = _l(u(r + t));
  }
  return { s, isSet, acc: _l(u(2779096485 ^ r)) };
}
function nextWord(state, t) {
  const r = state.s;
  const n = state.acc;
  const i = n % 61;
  const oVal = state.isSet[i] ? -1 : 0;
  const d = state.isSet[i] ? r[i] : 0;
  const c = u(Math.imul(t + 1, 2654435769));
  const sVal = u(d ^ c);
  const h = u(n ^ sVal | n & sVal & oVal);
  const term1 = _u(u(h + n), 31 & i);
  const term2 = _u(n, 31 & i * 7);
  const n2 = _l(u(u(term1 ^ term2) + 2654435769));
  r[i] = n2;
  state.isSet[i] = true;
  state.acc = n2;
  return u(n2);
}
function keystream(seed, tmdbId, len) {
  const st = initState(seed, tmdbId);
  const out = new Array(len);
  let wi = 0, bi = 0;
  while (bi < len) {
    const w = nextWord(st, wi++);
    out[bi++] = w & 255;
    if (bi < len) out[bi++] = w >>> 8 & 255;
    if (bi < len) out[bi++] = w >>> 16 & 255;
    if (bi < len) out[bi++] = w >>> 24 & 255;
  }
  return out;
}
function decrypt(cipherB64, seed, tmdbId) {
  const bytes = base64Decode(cipherB64);
  if (bytes.length <= MAGIC.length) return null;
  const ks = keystream(seed, tmdbId, bytes.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
  for (let k = 0; k < MAGIC.length; k++) if (bytes[k] !== MAGIC[k]) return null;
  return utf8Decode(bytes.slice(MAGIC.length));
}
function getSeed(tmdbId) {
  return __async(this, null, function* () {
    try {
      const r = yield fetchT(`${API}/seed?mediaId=${tmdbId}`, { headers: HEADERS }, 8e3);
      if (r.ok) return (yield r.json()).seed;
    } catch (e) {
    }
    return null;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    try {
      const isTv = mediaType === "tv";
      const seed = yield getSeed(tmdbId);
      if (!seed) return out;
      const meta = yield resolveMeta(tmdbId, mediaType);
      let q = `title=${encodeURIComponent(meta && meta.title || "")}&mediaType=${isTv ? "tv" : "movie"}`;
      if (meta && meta.year) q += `&year=${meta.year}`;
      if (isTv && season != null) q += `&seasonId=${season}`;
      if (isTv && episode != null) q += `&episodeId=${episode}`;
      q += `&tmdbId=${tmdbId}`;
      if (meta && meta.imdbId) q += `&imdbId=${meta.imdbId}`;
      q += `&enc=2&seed=${seed}`;
      yield Promise.all(SERVERS.map((server) => __async(this, null, function* () {
        try {
          let url = `${API}/${server.endpoint}/sources?${q}`;
          if (server.extra) url += `&${server.extra}`;
          const res = yield fetchT(url, { headers: HEADERS }, 8e3);
          if (!res.ok) return;
          const body = (yield res.text()).trim();
          if (!body || body.startsWith("<")) return;
          const decStr = decrypt(body, seed, tmdbId);
          if (!decStr) return;
          const parsed = JSON.parse(decStr);
          if (!Array.isArray(parsed.sources)) return;
          for (const src of parsed.sources) {
            const streamUrl = src && src.url;
            if (!streamUrl || seen.has(streamUrl)) continue;
            seen.add(streamUrl);
            const qy = parseQuality(src.quality || "") !== "Auto" ? parseQuality(src.quality || "") : src.quality || "Auto";
            out.push({
              name: `Movy ${server.name}`,
              title: `[Movy - ${server.name}] ${qy}`,
              url: streamUrl,
              quality: qy,
              headers: { "User-Agent": UA, Referer: "https://www.movy.bz/" }
            });
          }
        } catch (e) {
        }
      })));
    } catch (e) {
    }
    return sortByQuality(dedupByUrl(out));
  });
}
module.exports = { getStreams };
