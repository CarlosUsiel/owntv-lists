// copied from https://github.com/Trixjustbetter/videasy-nuvio@5fc9d1e7f79f (providers/videasy.js), GPL-3.0; the original file follows unchanged.
/**
 * videasy - Built from src/videasy/
 * Generated: 2026-08-23T14:33:42.709Z
 */
var __videasy = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
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

  // src/videasy/extractor.js
  function w(e) {
    e >>>= 0;
    e ^= e >>> 16;
    e = Math.imul(e, 2246822507) >>> 0;
    e ^= e >>> 13;
    e = Math.imul(e, 3266489909) >>> 0;
    return (e ^= e >>> 16) >>> 0;
  }
  function v(e, t) {
    e >>>= 0;
    t &= 31;
    if (t === 0)
      return e >>> 0;
    return (e << t | e >>> 32 - t) >>> 0;
  }
  function fnv1a(str) {
    let t = 2166136261;
    for (let i = 0; i < str.length; i++) {
      t = Math.imul(t ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    return w(t);
  }
  function keygen(seedStr, mediaId) {
    const S = Array(61);
    let a = w(fnv1a(seedStr) ^ w(Number(mediaId) >>> 0 ^ 2654435769)) >>> 0;
    for (let i = 0; i < 8; i++) {
      const idx = a % 61;
      a = v(a + 2654435769 >>> 0, 7 + (7 & i));
      S[idx] = (a ^ w(a)) >>> 0;
      a = w(a + idx >>> 0);
    }
    return { S, acc: w(2779096485 ^ a) >>> 0 };
  }
  function nextWord(state, counter) {
    const S = state.S;
    const o = state.acc;
    const n = o % 61;
    const mask = -Number(n in S);
    const d = S[n] !== void 0 ? S[n] : 0;
    const x = (d ^ Math.imul(2654435769, counter + 1)) >>> 0;
    let l = ((o ^ x) >>> 0 | (o & x & mask) >>> 0) >>> 0;
    l = (v(l + o >>> 0, 31 & n) ^ v(o, 31 & Math.imul(n, 7))) >>> 0;
    const newAcc = w(l + 2654435769 >>> 0);
    S[n] = newAcc >>> 0;
    state.acc = newAcc;
    return newAcc >>> 0;
  }
  function keystream(seedStr, mediaId, length) {
    const state = keygen(String(seedStr), mediaId);
    const out = new Uint8Array(length);
    let p = 0;
    let counter = 0;
    while (p < length) {
      const word = nextWord(state, counter++);
      out[p++] = word & 255;
      if (p < length)
        out[p++] = word >>> 8 & 255;
      if (p < length)
        out[p++] = word >>> 16 & 255;
      if (p < length)
        out[p++] = word >>> 24 & 255;
    }
    return out;
  }
  function base64UrlToBytes(input) {
    const s = input.replace(/-/g, "+").replace(/_/g, "/");
    const len = s.length;
    const bytes = new Uint8Array(Math.floor(len * 3 / 4));
    let p = 0;
    let acc = 0;
    let bits = 0;
    for (let i = 0; i < len; i++) {
      const val = B64_LOOKUP[s[i]];
      if (val === void 0 || s[i] === "=")
        break;
      acc = (acc << 6 | val) >>> 0;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes[p++] = acc >>> bits & 255;
      }
    }
    return bytes.subarray(0, p);
  }
  function utf8Decode(bytes) {
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i];
      if (b < 128) {
        out += String.fromCharCode(b);
        i += 1;
      } else if ((b & 224) === 192) {
        out += String.fromCharCode((b & 31) << 6 | bytes[i + 1] & 63);
        i += 2;
      } else if ((b & 240) === 224) {
        out += String.fromCharCode(
          (b & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63
        );
        i += 3;
      } else {
        const cp = ((b & 7) << 18 | (bytes[i + 1] & 63) << 12 | (bytes[i + 2] & 63) << 6 | bytes[i + 3] & 63) - 65536;
        out += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
        i += 4;
      }
    }
    return out;
  }
  function decryptPayload(bodyB64, seed, mediaId) {
    const bytes = base64UrlToBytes(bodyB64);
    const ks = keystream(seed, mediaId, bytes.length);
    for (let i = 0; i < bytes.length; i++)
      bytes[i] ^= ks[i];
    for (let i = 0; i < MAGIC.length; i++) {
      if (bytes[i] !== MAGIC[i]) {
        throw new Error("videasy decrypt failed: bad seed or tampered payload");
      }
    }
    return utf8Decode(bytes.subarray(MAGIC.length));
  }
  function qs(params) {
    const parts = [];
    for (const key in params) {
      if (!Object.prototype.hasOwnProperty.call(params, key))
        continue;
      const val = params[key];
      if (val === void 0 || val === null)
        continue;
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(val));
    }
    return parts.join("&");
  }
  function responseText(res) {
    return __async(this, null, function* () {
      if (typeof res === "string")
        return res;
      if (res && typeof res.text === "function")
        return yield res.text();
      if (res && typeof res._bodyText === "string")
        return res._bodyText;
      if (res && typeof res.body === "string")
        return res.body;
      const keys = res ? Object.keys(res).join(",") : String(res);
      throw new Error("unsupported response object [" + keys + "]");
    });
  }
  function statusOf(res) {
    if (!res)
      return 0;
    if (typeof res.status === "number")
      return res.status;
    if (typeof res.code === "number")
      return res.code;
    if (typeof res.statusCode === "number")
      return res.statusCode;
    return 200;
  }
  function httpGet(url) {
    return __async(this, null, function* () {
      if (typeof fetch !== "function") {
        throw new Error("fetch is not available in this runtime");
      }
      let res;
      try {
        res = yield fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": STREAM_HEADERS["User-Agent"],
            "Referer": "https://player.videasy.to/"
          }
        });
      } catch (e) {
        throw new Error("network error: " + (e && e.message || String(e)));
      }
      const status = statusOf(res);
      const text = yield responseText(res);
      return { status, text };
    });
  }
  function getSeed(mediaId) {
    return __async(this, null, function* () {
      const cacheKey = String(API_BASE) + "|" + String(mediaId);
      const cached = seedCache.get(cacheKey);
      if (cached && cached.expiresAt - 5e3 > Date.now())
        return cached.seed;
      let p = seedInflight.get(cacheKey);
      if (p)
        return p;
      p = (() => __async(this, null, function* () {
        const data = JSON.parse((yield httpGet(`${API_BASE}/seed?${qs({ mediaId })}`)).text);
        const ttl = typeof data.ttlMs === "number" && !isNaN(data.ttlMs) ? data.ttlMs : SEED_TTL_DEFAULT;
        seedCache.set(cacheKey, { seed: data.seed, expiresAt: Date.now() + ttl });
        return data.seed;
      }))().finally(() => seedInflight.delete(cacheKey));
      seedInflight.set(cacheKey, p);
      return p;
    });
  }
  function fetchEncrypted(path, params, mediaId) {
    return __async(this, null, function* () {
      const attempt = () => __async(this, null, function* () {
        const seed = yield getSeed(mediaId);
        const url = `${API_BASE}${path}?${qs(Object.assign({}, params, { enc: "2", seed }))}`;
        const res = yield httpGet(url);
        if (res.status !== 200) {
          const err = new Error(`HTTP ${res.status} from ${path}`);
          err.status = res.status;
          throw err;
        }
        try {
          return decryptPayload(res.text, seed, mediaId);
        } catch (e) {
          console.log(`[Videasy][DBG] ${path} body[:120]=${res.text.slice(0, 120)}`);
          throw e;
        }
      });
      try {
        return yield attempt();
      } catch (e) {
        if (e && e.status === 401) {
          seedCache.clear();
          return attempt();
        }
        throw e;
      }
    });
  }
  function normalizeQuality(q) {
    if (!q)
      return "";
    const match = String(q).match(/(\d{3,4})\s*p/i);
    if (match)
      return match[1] + "p";
    if (/4k|2160/i.test(String(q)))
      return "4K";
    return String(q);
  }
  function qualityRank(q) {
    const s = String(q || "");
    const match = s.match(/(\d{3,4})\s*p/i);
    const h = match ? Number(match[1]) : /4k|2160/i.test(s) ? 2160 : 0;
    if (h >= 2160)
      return 0;
    if (h >= 1080)
      return 1;
    if (h >= 720)
      return 2;
    if (h >= 480)
      return 3;
    if (h > 0)
      return 4;
    return 5;
  }
  function headerOf(res, name) {
    try {
      const h = res && res.headers;
      if (!h)
        return "";
      if (typeof h.get === "function") {
        const v2 = h.get(name);
        if (v2)
          return String(v2);
      }
      if (h.map && typeof h.map === "object") {
        for (const k in h.map) {
          if (Object.prototype.hasOwnProperty.call(h.map, k) && k.toLowerCase() === name) {
            return String(h.map[k]);
          }
        }
      }
      for (const k in h) {
        if (Object.prototype.hasOwnProperty.call(h, k) && k.toLowerCase() === name) {
          return String(h[k]);
        }
      }
    } catch (e) {
    }
    return "";
  }
  function probeFileSize(url) {
    return __async(this, null, function* () {
      if (!/\.(mp4|mkv|avi|mov|webm|m4v)(\?|$)/i.test(String(url)))
        return "";
      try {
        let len = NaN;
        try {
          const head = yield fetch(url, { method: "HEAD", headers: STREAM_HEADERS });
          len = parseInt(headerOf(head, "content-length"), 10);
        } catch (e) {
        }
        if (!isFinite(len) || len < 10 * 1024 * 1024) {
          try {
            const ranged = yield fetch(url, {
              method: "GET",
              headers: Object.assign({}, STREAM_HEADERS, { Range: "bytes=0-0" })
            });
            const cr = headerOf(ranged, "content-range");
            const m = cr.match(/\/(\d+)\s*$/);
            if (m) {
              const total = parseInt(m[1], 10);
              if (!isFinite(len) || total > len)
                len = total;
            }
          } catch (e2) {
          }
        }
        if (!isFinite(len) || len < 10 * 1024 * 1024)
          return "";
        const gb = len / 1073741824;
        return gb >= 1 ? Math.round(gb * 10) / 10 + " GB" : Math.round(len / 1048576) + " MB";
      } catch (e) {
        return "";
      }
    });
  }
  function serverStreams(server, params, tmdbId) {
    return __async(this, null, function* () {
      const text = yield fetchEncrypted(server.path, params, tmdbId);
      const data = JSON.parse(text);
      let sources = data.sources || [];
      if (server.filterQuality) {
        sources = sources.filter((s) => s && s.quality === server.filterQuality);
      }
      if (server.preferDash) {
        const dash = sources.filter(
          (s) => s && (s.type === "dash" || s.url && String(s.url).toLowerCase().includes(".mpd"))
        );
        sources = dash.length > 0 ? dash : sources;
      }
      const streams = [];
      for (const src of sources) {
        if (!src || !src.url)
          continue;
        streams.push({
          // NOTE: no `name` field on purpose -- Nuvio uses name||title as the
          // row label AND sorts rows alphabetically by it, so we control
          // order through numbered titles added in extractStreams().
          title: `${server.name} \u2022 ${src.quality || "Auto"}${server.lang ? " \u2022 " + server.lang : ""}`,
          url: String(src.url),
          quality: normalizeQuality(src.quality),
          type: src.type || (String(src.url).includes(".mpd") ? "dash" : "hls"),
          headers: STREAM_HEADERS
        });
      }
      const sized = yield Promise.allSettled(streams.map((s) => probeFileSize(s.url)));
      for (let i = 0; i < streams.length; i++) {
        const r = sized[i];
        if (r.status === "fulfilled" && r.value) {
          streams[i].title += " \u2022 " + r.value;
          streams[i].size = r.value;
        }
      }
      return streams;
    });
  }
  function extractStreams(tmdbId, mediaType, season, episode) {
    return __async(this, null, function* () {
      console.log(`[Videasy][DBG] runtime: fetch=${typeof fetch} Map=${typeof Map} Uint8Array=${typeof Uint8Array} imul=${typeof Math.imul}`);
      const isTv = String(mediaType).toLowerCase() === "tv" || String(mediaType).toLowerCase() === "series";
      const params = { mediaType: isTv ? "tv" : "movie", tmdbId: Number(tmdbId) };
      if (isTv) {
        params.seasonId = Number(season) || 1;
        params.episodeId = Number(episode) || 1;
      }
      const results = yield Promise.allSettled(
        SERVERS.map((server) => serverStreams(server, params, tmdbId))
      );
      const out = [];
      for (let i = 0; i < SERVERS.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled") {
          for (const s of r.value)
            out.push(s);
        } else {
          const reason = r.reason && r.reason.message ? r.reason.message : String(r.reason);
          console.log(`[Videasy] ${SERVERS[i].name}: ${reason}`);
        }
      }
      out.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));
      for (let i = 0; i < out.length; i++) {
        const nn = (i + 1 < 10 ? "0" : "") + (i + 1);
        out[i].title = nn + ". " + out[i].title;
      }
      return out;
    });
  }
  var API_BASE, SEED_TTL_DEFAULT, STREAM_HEADERS, MAGIC, B64_CHARS, B64_LOOKUP, seedCache, seedInflight, SERVERS;
  var init_extractor = __esm({
    "src/videasy/extractor.js"() {
      API_BASE = "https://api.speedracelight.com";
      SEED_TTL_DEFAULT = 3e4;
      STREAM_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        // NB: videasy moved .net -> .to; the CDN enforces the new referer on /r2/cdn1 paths.
        "Referer": "https://player.videasy.to/"
      };
      MAGIC = [109, 118, 109, 49];
      B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      B64_LOOKUP = {};
      for (let bi = 0; bi < B64_CHARS.length; bi++)
        B64_LOOKUP[B64_CHARS[bi]] = bi;
      seedCache = /* @__PURE__ */ new Map();
      seedInflight = /* @__PURE__ */ new Map();
      SERVERS = [
        { name: "Yoru", path: "/cdn/sources-with-title" },
        { name: "Cypher", path: "/downloader2/sources-with-title" },
        { name: "Breach", path: "/m4uhd/sources-with-title" },
        { name: "Neon", path: "/vsrc/sources-with-title", preferDash: true },
        // Vyse (/hdmovie) removed: takes ~7s to return 500 and drags down the
        // whole allSettled() window. Omen/Raze stay (fast failures).
        { name: "Omen", path: "/lamovie/sources-with-title", lang: "Spanish" },
        { name: "Raze", path: "/superflix/sources-with-title", lang: "Portuguese" }
      ];
    }
  });

  // src/videasy/index.js
  var require_videasy = __commonJS({
    "src/videasy/index.js"(exports, module) {
      init_extractor();
      function getStreams(tmdbId, mediaType, season, episode) {
        return __async(this, null, function* () {
          try {
            console.log(`[Videasy] Request: ${mediaType} ${tmdbId} S${season || "-"}E${episode || "-"}`);
            const streams = yield extractStreams(tmdbId, mediaType, season, episode);
            console.log(`[Videasy] Found ${streams.length} stream(s)`);
            return streams;
          } catch (error) {
            const msg = error && error.message || String(error);
            const stackTop = error && error.stack ? String(error.stack).split("\n")[0] : "";
            console.error(`[Videasy] Error: ${msg}${stackTop && stackTop !== msg ? " | " + stackTop : ""}`);
            return [];
          }
        });
      }
      module.exports = { getStreams };
    }
  });
  return require_videasy();
})();

if (typeof globalThis !== 'undefined') { globalThis.getStreams = __videasy.getStreams; }
if (typeof global !== 'undefined') { global.getStreams = __videasy.getStreams; }
if (typeof self !== 'undefined') { self.getStreams = __videasy.getStreams; }
if (typeof module !== 'undefined' && module.exports) { module.exports = __videasy; }

