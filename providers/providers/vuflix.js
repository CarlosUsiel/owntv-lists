// copied from https://github.com/ahmedelkassrawy/nuvio-providers@6ffcfa8f0e21 (providers/vuflix.js), no licence stated by the repository; the original file follows unchanged.
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
    function parseQuality(s) {
      const t = String(s || "");
      if (/2160|\b4k\b|uhd/i.test(t)) return "2160p";
      if (/1080/.test(t)) return "1080p";
      if (/720/.test(t)) return "720p";
      if (/480/.test(t)) return "480p";
      if (/\bcam\b/i.test(t)) return "CAM";
      return "Auto";
    }
    module2.exports = { dedupByUrl: dedupByUrl2, sortByQuality: sortByQuality2, parseQuality };
  }
});

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

// src/vuflix.js
var { base64Decode, utf8Decode } = require_crypto();
var { dedupByUrl, sortByQuality } = require_dedup();
var { fetchT } = require_http();
var API = "https://vuflix.co";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var H = { "User-Agent": UA, Referer: "https://vuflix.co/", Origin: "https://vuflix.co", Accept: "application/json, text/plain, */*" };
var FALLBACK = [
  { id: "vsembed", name: "Sigma" },
  { id: "moonflix", name: "Source 40" },
  { id: "megasource", name: "Source 39" },
  { id: "hdghar", name: "Source 44" },
  { id: "moviebox", name: "Pi" },
  { id: "cineplay", name: "4K" },
  { id: "huhu", name: "Beta" },
  { id: "bingr", name: "Upsilon" },
  { id: "onlyflix", name: "Gamma" },
  { id: "vaplayer", name: "Alpha" },
  { id: "flixhqz", name: "Gamma" },
  { id: "castle", name: "Source 40" },
  { id: "cinejoy", name: "4K2" },
  { id: "filesun", name: "Tau" },
  { id: "yoru", name: "Yoru" }
];
function unwrap(rawUrl) {
  const def = { url: rawUrl, headers: { "User-Agent": UA, Referer: "https://vuflix.co/", Origin: "https://vuflix.co" } };
  if (!rawUrl || !rawUrl.includes("v-relay?t=") && !rawUrl.includes("a-relay?t=")) return def;
  try {
    const m = rawUrl.match(/[?&]t=([^&]+)/);
    if (!m) return def;
    const json = utf8Decode(base64Decode(decodeURIComponent(m[1])));
    const parsed = JSON.parse(json);
    const directUrl = String(parsed && parsed.u || "").trim();
    if (!directUrl) return def;
    const headers = { "User-Agent": UA, Referer: "https://vuflix.co/", Origin: "https://vuflix.co" };
    if (parsed.h && typeof parsed.h === "object") for (const k of Object.keys(parsed.h)) headers[k] = String(parsed.h[k]);
    return { url: directUrl, headers };
  } catch (e) {
    return def;
  }
}
function getProviders() {
  return __async(this, null, function* () {
    try {
      const r = yield fetchT(`${API}/api/player/providers`, { headers: H }, 6e3);
      if (r.ok) {
        const d = yield r.json();
        if (d && d.ok === true && Array.isArray(d.providers)) {
          const list = d.providers.filter((p) => p && p.id != null).map((p) => ({ id: String(p.id).trim(), name: String(p.publicLabel || p.providerName || p.name || p.id) })).filter((p) => p.id);
          if (list.length) return list;
        }
      }
    } catch (e) {
    }
    return FALLBACK;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    try {
      const isTv = mediaType === "tv";
      let base = `type=${isTv ? "tv" : "movie"}&tmdbId=${tmdbId}`;
      if (isTv) base += `&season=${season || 1}&episode=${episode || 1}`;
      const providers = yield getProviders();
      const add = (rawUrl, provName, quality, tag) => {
        if (!rawUrl) return;
        const un = unwrap(rawUrl);
        if (!un.url || seen.has(un.url)) return;
        seen.add(un.url);
        out.push({
          name: `Vuflix ${provName}`,
          title: `[Vuflix - ${provName}]${tag ? " " + tag : ""} ${quality || ""}`.trim(),
          url: un.url,
          quality: quality || "Auto",
          headers: un.headers
        });
      };
      yield Promise.all(providers.map((prov) => __async(this, null, function* () {
        try {
          const res = yield fetchT(`${API}/api/player/sources?${base}&provider=${prov.id}`, { headers: H }, 8e3);
          if (!res.ok) return;
          const data = yield res.json();
          if (!data || data.ok !== true || !Array.isArray(data.sources)) return;
          for (const item of data.sources) {
            if (!item || typeof item !== "object") continue;
            const pName = String(item.providerName || item.publicLabel || prov.name);
            if (Array.isArray(item.qualities)) {
              for (const q of item.qualities) if (q && q.url) add(q.url, pName, String(q.quality || "Auto"));
            }
            if (Array.isArray(item.candidates)) {
              let i = 1;
              for (const c of item.candidates) if (c && c.url) add(c.url, pName, String(c.quality || "1080p"), `Mirror ${i++}`);
            }
            if (Array.isArray(item.audioTracks)) for (const a of item.audioTracks) {
              const au = a && (a.switchUrl || a.url);
              if (au) add(au, pName, "HD", String(a.label || a.language || "Audio") + " Audio");
            }
            if (item.url) add(item.url, pName, String(item.quality || (String(item.type).toLowerCase() === "mp4" ? "MP4" : "HD")));
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
